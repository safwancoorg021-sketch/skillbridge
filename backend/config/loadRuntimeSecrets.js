const { GetParametersByPathCommand, SSMClient } = require("@aws-sdk/client-ssm");

const RUNTIME_PARAMETER_PATH = "/skillbridge/runtime";
const ALLOWED_SECRET_NAMES = new Set([
  "MONGODB_URI",
  "JWT_SECRET",
  "EMAIL_USER",
  "EMAIL_APP_PASSWORD",
  "GOOGLE_CLIENT_ID",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
]);

async function loadRuntimeSecrets() {
  const configuredPath = process.env.SKILLBRIDGE_SSM_PATH;
  if (!configuredPath) return;

  const parameterPath = configuredPath.replace(/\/+$/, "");
  if (parameterPath !== RUNTIME_PARAMETER_PATH) {
    throw new Error("SKILLBRIDGE_SSM_PATH must point to the SkillBridge runtime parameter path.");
  }

  const client = new SSMClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2",
  });
  const loadedNames = new Set();
  let nextToken;

  do {
    const response = await client.send(new GetParametersByPathCommand({
      Path: parameterPath,
      Recursive: false,
      WithDecryption: true,
      NextToken: nextToken,
    }));

    for (const parameter of response.Parameters || []) {
      const name = parameter.Name?.slice(parameterPath.length + 1);
      // PORT is local server configuration, not a secret. Let Amplify provide
      // the listener port instead of overriding it from Parameter Store.
      if (name === "PORT") continue;

      if (!name || !ALLOWED_SECRET_NAMES.has(name)) {
        throw new Error("The SkillBridge runtime parameter path contains an unexpected parameter name.");
      }
      if (typeof parameter.Value !== "string" || parameter.Value.length === 0) {
        throw new Error(`The SkillBridge runtime parameter ${name} has no value.`);
      }

      process.env[name] = parameter.Value;
      loadedNames.add(name);
    }

    nextToken = response.NextToken;
  } while (nextToken);

  const missingNames = [...ALLOWED_SECRET_NAMES].filter((name) => !loadedNames.has(name));
  if (missingNames.length > 0) {
    throw new Error(`Missing SkillBridge runtime parameters: ${missingNames.join(", ")}.`);
  }
}

module.exports = loadRuntimeSecrets;

