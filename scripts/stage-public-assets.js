import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const root = process.cwd();
const outputDir = join(root, ".deploy", "public");
const deployableExtensions = new Set([".html", ".css", ".js", ".svg", ".ics"]);

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
