import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

const generatedConfigFiles = ["next-env.d.ts", "tsconfig.json"];
const originals = new Map(
  await Promise.all(generatedConfigFiles.map(async (file) => [file, await readFile(file)])),
);

let exitCode = 1;
try {
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolvePath("node_modules/@playwright/test/cli.js"), "test", ...process.argv.slice(2)], {
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await Promise.all([...originals].map(([file, contents]) => writeFile(file, contents)));
}

process.exitCode = exitCode;
