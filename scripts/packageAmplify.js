const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, ".amplify-hosting");
const compute = path.join(output, "compute", "default");
const backendSource = path.join(root, "backend");

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(compute, "backend"), { recursive: true });

fs.cpSync(backendSource, path.join(compute, "backend"), {
  recursive: true,
  filter(source) {
    const relative = path.relative(backendSource, source);
    if (!relative) return true;
    const parts = relative.split(path.sep);
    const name = parts[parts.length - 1];
    return !parts.includes("node_modules")
      && !parts.includes("uploads")
      && name !== ".env"
      && !name.startsWith(".env.")
      && name !== ".git"
      && name !== "dist";
  },
});

const sourceModules = path.join(backendSource, "node_modules");
if (!fs.existsSync(sourceModules)) {
  throw new Error("Backend dependencies are missing. Run npm ci in backend before packaging.");
}
fs.cpSync(sourceModules, path.join(compute, "backend", "node_modules"), { recursive: true });

const frontendDist = path.join(root, "frontend", "dist");
if (!fs.existsSync(path.join(frontendDist, "index.html"))) {
  throw new Error("Frontend build is missing. Run npm run build in frontend before packaging.");
}
fs.cpSync(frontendDist, path.join(compute, "frontend", "dist"), { recursive: true });
fs.mkdirSync(path.join(compute, "backend", "uploads"), { recursive: true });

fs.writeFileSync(path.join(compute, "server.js"), [
  'const path = require("path");',
  'process.env.NODE_ENV = "production";',
  'process.env.PORT ||= "3000";',
  'process.env.TRUST_PROXY_HOPS ||= "1";',
  'process.env.SKILLBRIDGE_SSM_PATH ||= "/skillbridge/runtime";',
  'process.chdir(path.join(__dirname, "backend"));',
  'require(path.join(__dirname, "backend", "server.js"));',
  "",
].join("\n"));

fs.writeFileSync(path.join(output, "deploy-manifest.json"), JSON.stringify({
  version: 1,
  framework: { name: "express", version: "5.3.0" },
  routes: [
    { path: "/*", target: { kind: "Compute", src: "default" } },
  ],
  computeResources: [
    { name: "default", runtime: "nodejs22.x", entrypoint: "server.js" },
  ],
}, null, 2));

function directorySize(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directory, entry.name);
    return total + (entry.isDirectory() ? directorySize(entryPath) : fs.statSync(entryPath).size);
  }, 0);
}

const computeBytes = directorySize(compute);
const maximumBytes = 220 * 1024 * 1024;
if (computeBytes > maximumBytes) {
  throw new Error(`Amplify compute bundle is ${(computeBytes / 1024 / 1024).toFixed(1)} MB; the limit is 220 MB.`);
}

console.log(`Packaged Amplify compute bundle: ${(computeBytes / 1024 / 1024).toFixed(1)} MB.`);
