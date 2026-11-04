const { spawnSync } = require("node:child_process");
const path = require("node:path");

const script = path.join(__dirname, "attendance-regression.ps1");
const args = ["-NoProfile", "-File", script, ...process.argv.slice(2)];
let result = spawnSync("pwsh", args, { stdio: "inherit" });
if (process.platform === "win32" && result.error?.code === "ENOENT") {
  result = spawnSync("powershell.exe", ["-ExecutionPolicy", "Bypass", ...args], { stdio: "inherit" });
}
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
