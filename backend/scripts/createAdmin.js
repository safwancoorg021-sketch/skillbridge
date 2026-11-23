require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const readline = require("readline");
const User = require("../models/User");

const passwordIsValid = (value) =>
  value.length >= 8 &&
  value.length <= 128 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /[0-9]/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

function ask(question) {
  return new Promise((resolve) => {
    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      crlfDelay: Infinity,
    });
    terminal.question(question, (answer) => {
      terminal.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  const input = process.stdin;

  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(
      new Error("Run this command in an interactive terminal so the password stays hidden.")
    );
  }

  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0003" || character === "\u001a") {
          finish(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from backend/.env.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const email = (await ask("Admin email: ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const existing = await User.findOne({ email }).select("+password authProvider role isEmailVerified isBlocked");

  if (existing) {
    if (existing.role === "admin") {
      console.log("This account is already an administrator.");
      return;
    }
    if (existing.authProvider !== "local" || !existing.password) {
      throw new Error(
        "This email uses Google sign-in. Choose a local email and password for the admin account."
      );
    }
    if (!existing.isEmailVerified) {
      throw new Error(
        "Verify this account's email first, then run the admin setup command again."
      );
    }
    if (existing.isBlocked) {
      throw new Error(
        "This account is blocked. Unblock it before using it for administrator access."
      );
    }

    const confirmation = await ask(
      "This will give the existing account administrator access. Type PROMOTE to confirm: "
    );
    if (confirmation !== "PROMOTE") {
      console.log("No changes made.");
      return;
    }

    await User.updateOne(
      { _id: existing._id, role: "student", isBlocked: false },
      { $set: { role: "admin" }, $inc: { tokenVersion: 1 } }
    );
    console.log("Administrator access enabled for the existing account.");
    return;
  }

  const name = await ask("Admin name: ");
  if (name.length < 2 || name.length > 80) {
    throw new Error("Name must be between 2 and 80 characters.");
  }

  const password = await askHidden("New admin password (typing is hidden): ");
  if (!passwordIsValid(password)) {
    throw new Error(
      "Password must be 8–128 characters and include uppercase, lowercase, a number, and a symbol."
    );
  }
  const confirmation = await askHidden("Confirm admin password: ");
  if (password !== confirmation) {
    throw new Error("Passwords do not match. No account was created.");
  }

  const createConfirmation = await ask(
    "Create this local administrator account? Type CREATE to confirm: "
  );
  if (createConfirmation !== "CREATE") {
    console.log("No changes made.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    name,
    email,
    password: passwordHash,
    authProvider: "local",
    role: "admin",
    isEmailVerified: true,
    isBlocked: false,
    tokenVersion: 0,
  });

  console.log("Administrator account created and verified for local testing.");
}

main()
  .catch((error) => {
    const safeMessage =
      error.name === "Error"
        ? error.message
        : "Admin setup failed. Check the MongoDB settings in backend/.env and confirm that the database is available.";
    console.error(safeMessage);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });



