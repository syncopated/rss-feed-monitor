import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default: every 2 minutes. Override with: npm run watch -- 5 (for 5 minutes)
const intervalMin = parseFloat(process.argv[2] ?? "2");
const intervalMs = intervalMin * 60 * 1000;

function runFetch(): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn(
      "npx",
      ["tsx", path.join(__dirname, "fetch.ts")],
      { stdio: "inherit" }
    );
    proc.on("close", () => resolve());
  });
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function nextRunAt(ms: number): string {
  const d = new Date(Date.now() + ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  console.log(`Local feed watcher — running every ${intervalMin} min`);
  console.log("Press Ctrl+C to stop\n");

  while (true) {
    console.log(`--- ${new Date().toISOString()} ---`);
    await runFetch();
    console.log(`Next run at ${nextRunAt(intervalMs)}\n`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();
