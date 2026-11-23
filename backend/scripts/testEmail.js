
require("dotenv").config();

const transporter = require("../config/mailer");

const testEmail = async () => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "SkillBridge Email Test",
      text: "Success! SkillBridge can send emails using Nodemailer.",
    });

    console.log("Test email sent successfully!");
  } catch (error) {
    console.error("Email test failed:", error.message);
    process.exitCode = 1;
  }
};

testEmail();
