import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const source = args.get("--source");
const input = args.get("--input");
const selectionPath = args.get("--selection");
const museScore = args.get("--musescore");
if (!source || !input || !selectionPath) {
  throw new Error("Usage: node scripts/import-score-library.mjs --source openscore-lieder|pdmx --input <checkout-or-archive> --selection <json> [--musescore <MuseScore3>] ");
}

const run = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
  });

const selection = JSON.parse(await readFile(selectionPath, "utf8"));
const libraryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/score-library/assets");

if (source === "openscore-lieder") {
  if (!museScore) throw new Error("--musescore is required for OpenScore conversion");
  const destination = path.join(libraryRoot, "openscore-lieder");
  await mkdir(destination, { recursive: true });
  const temp = await mkdtemp(path.join(os.tmpdir(), "melodica-openscore-"));
  const jobPath = path.join(temp, "conversion-job.json");
  const jobs = selection.map((entry) => ({
    in: path.resolve(input, ...entry.path.split("/")),
    out: path.join(destination, `${entry.id}.mxl`),
  }));
  await writeFile(jobPath, JSON.stringify(jobs, null, 2));
  try {
    await run(path.resolve(museScore), ["-j", jobPath]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  console.log(`Converted ${jobs.length} OpenScore Lieder files.`);
} else if (source === "pdmx") {
  const destination = path.join(libraryRoot, "pdmx");
  await mkdir(destination, { recursive: true });
  const temp = await mkdtemp(path.join(os.tmpdir(), "melodica-pdmx-"));
  try {
    const archivePaths = selection.map((entry) => entry.archivePath.replace(/^\.\//, ""));
    await run("tar", ["-xzf", path.resolve(input), "-C", temp, ...archivePaths]);
    for (const entry of selection) {
      const extracted = path.join(temp, ...entry.archivePath.replace(/^\.\//, "").split("/"));
      await copyFile(extracted, path.join(destination, `${entry.id}.mxl`));
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  console.log(`Imported ${selection.length} approved PDMX files.`);
} else {
  throw new Error(`Unsupported source: ${source}`);
}
