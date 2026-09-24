import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pages = ["index.html", "season.html", "about.html", "award.html", "resources.html", "past-talks.html", "submission.html"];
const origin = "https://microstructure.exchange";

export function addSocialMetadata(directory) {
  for (const page of pages) {
    const path = join(directory, page);
    let html = readFileSync(path, "utf8");
    html = html.replace(/\n\s*<!-- Social preview -->[\s\S]*?<!-- End social preview -->/g, "");
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    if (!title || !description) throw new Error(`Missing title or description: ${page}`);
    const safeTitle = title.replaceAll('"', "&quot;");
    const url = `${origin}/${page === "index.html" ? "" : page}`;
    const image = `${origin}/social-preview.png`;
    const alt = "TME — The Microstructure Exchange. Market structure webinars.";
    const tags = `
  <!-- Social preview -->
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="The Microstructure Exchange">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${alt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${alt}">
  <!-- End social preview -->`;
    html = html.replace(/(<meta name="description" content="[^"]*">)/, `$1${tags}`);
    writeFileSync(path, html);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  addSocialMetadata(process.cwd());
}
