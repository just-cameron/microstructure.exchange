import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { addSocialMetadata } from "./social-metadata.js";
import { buildTalkSharing } from "./build-talk-sharing.js";

const root = process.cwd();
const outputDir = join(root, ".deploy", "public");
const deployableExtensions = new Set([".html", ".css", ".js", ".svg", ".ics", ".png"]);

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const entry of readdirSync(root)) {
  const source = join(root, entry);
  if (!statSync(source).isFile()) {
    continue;
  }

  if (deployableExtensions.has(extname(entry))) {
    cpSync(source, join(outputDir, entry));
  }
}

// Preserve the original public URLs for papers from the archived website.
cpSync(join(root, "old-website", "papers"), join(outputDir, "papers"), { recursive: true });
addSocialMetadata(outputDir);
// Retain published talk pages when the current season is replaced.
if (existsSync(join(root, "talks"))) cpSync(join(root, "talks"), join(outputDir, "talks"), { recursive: true });
await buildTalkSharing(outputDir);
