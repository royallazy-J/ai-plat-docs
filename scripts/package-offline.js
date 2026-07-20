const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const deploymentDir = path.join(root, "deployment");
const releaseDir = path.join(root, "release", "ai-plat-docs-offline");

if (!fs.existsSync(publicDir)) {
  throw new Error("未找到 public 目录。请先执行 npm run build。");
}

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
fs.cpSync(publicDir, path.join(releaseDir, "site"), { recursive: true });
fs.copyFileSync(path.join(deploymentDir, "nginx.conf"), path.join(releaseDir, "nginx.conf"));
fs.copyFileSync(path.join(deploymentDir, "README.md"), path.join(releaseDir, "README.md"));

console.log(`Offline package created at ${releaseDir}`);
