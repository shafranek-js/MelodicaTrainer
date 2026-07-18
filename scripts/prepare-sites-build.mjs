import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";

await rm("dist/local-score-library", { force: true, recursive: true });

const staticEntries = (await readdir("dist", { withFileTypes: true }))
  .filter(({ name }) => ![".openai", "client", "server"].includes(name));

await mkdir("dist/client", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

await Promise.all([
  ...staticEntries.map(({ name }) =>
    cp(`dist/${name}`, `dist/client/${name}`, { recursive: true }),
  ),
  copyFile("worker/index.js", "dist/server/index.js"),
  copyFile(".openai/hosting.json", "dist/.openai/hosting.json"),
]);
