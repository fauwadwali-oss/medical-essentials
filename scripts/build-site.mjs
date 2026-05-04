import { mkdir, copyFile, rm } from "node:fs/promises";

const outputDir = "dist";
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "CNAME",
  "_headers"
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(`${outputDir}/data`, { recursive: true });

for (const file of files) {
  await copyFile(file, `${outputDir}/${file}`);
}

await copyFile("data/shorts.json", `${outputDir}/data/shorts.json`);

console.log(`Built static site in ${outputDir}`);
