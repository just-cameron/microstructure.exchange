import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const origin = "https://microstructure.exchange";
const escape = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));

function lines(text, limit) {
  const result = [""];
  for (const word of text.split(/\s+/)) {
    const i = result.length - 1;
    if (result[i] && result[i].length + word.length + 1 > limit) result.push(word);
    else result[i] += (result[i] ? " " : "") + word;
  }
  return result;
}

export async function buildTalkSharing(directory) {
  const home = readFileSync(join(directory, "index.html"), "utf8");
  const match = home.match(/const seasonTalks = (\[.*?\]);/s);
  if (!match) throw new Error("No schedule data found for talk sharing");
  const talks = JSON.parse(match[1]);
  const header = home.match(/<header[\s\S]*?<\/header>/)[0].replaceAll('href="', 'href="/').replaceAll(' class="active-nav"', '');
  const footer = home.match(/<footer[\s\S]*?<\/footer>/)[0].replace(/href="(?!https?:|mailto:|\/)/g, 'href="/');
  const zoom = home.match(/https:\/\/us06web\.zoom\.us\/[^"<>]+/)[0];
  const output = join(directory, "talks");
  mkdirSync(output, { recursive: true });
  const manifest = [];
  for (const talk of talks) {
    const id = talk.startIso.slice(0, 10);
    const url = `${origin}/talks/${id}`;
    const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(talk.startIso));
    const socialTitle = `${talk.presenter} | TME | ${talk.title}`;
    const description = `${date}. ${talk.title}. Authors: ${talk.authors}. The Microstructure Exchange.`;
    const imageAlt = `${talk.presenter}: ${talk.title}. ${date}.`;
    const titleLines = lines(talk.title, 43);
    const authorLines = lines(talk.authors, 85);
    if (titleLines.length > 3 || authorLines.length > 2) throw new Error(`Sharing card needs a smaller font: ${id}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#edf1f5"/>
      <rect x="64" y="48" width="116" height="90" rx="16" fill="#2467a6"/>
      <g font-family="Arial, sans-serif">
      <text x="122" y="107" text-anchor="middle" font-size="36" font-weight="700" fill="#f7f9fb">TME</text>
      <text x="208" y="86" font-size="28" font-weight="600" fill="#19232d">Microstructure Exchange Webinar Series</text>
      <text x="208" y="122" font-size="23" fill="#526171">Market structure webinars</text>
      <text x="64" y="208" font-size="43" font-weight="700" fill="#2467a6">${escape(talk.presenter)}</text>
      ${titleLines.map((line, i) => `<text x="64" y="${278 + i * 54}" font-size="43" font-weight="600" fill="#19232d">${escape(line)}</text>`).join("")}
      ${authorLines.map((line, i) => `<text x="64" y="${444 + i * 30}" font-size="23" fill="#526171">${escape(line)}</text>`).join("")}
      <text x="64" y="548" font-size="29" font-weight="600" fill="#2467a6">${escape(date)}</text>
      <text x="64" y="590" font-size="22" fill="#526171">microstructure.exchange</text></g></svg>`;
    const version = createHash("sha256").update(svg).digest("hex").slice(0, 10);
    const imageName = `${id}-${version}.png`;
    const imageUrl = `${origin}/talks/${imageName}`;
    await sharp(Buffer.from(svg)).png().toFile(join(output, imageName));
    const tags = [ ["og:type", "website"], ["og:site_name", "The Microstructure Exchange"], ["og:title", socialTitle], ["og:description", description], ["og:url", url], ["og:image", imageUrl], ["og:image:width", "1200"], ["og:image:height", "630"], ["og:image:type", "image/png"], ["og:image:alt", imageAlt], ["twitter:card", "summary_large_image"], ["twitter:title", socialTitle], ["twitter:description", description], ["twitter:image", imageUrl], ["twitter:image:alt", imageAlt] ];
    const action = (label, href) => href ? `<a class="pill" href="${escape(href)}">${label}</a>` : "";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escape(socialTitle)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${url}">
      ${tags.map(([key,value])=>`<meta ${key.startsWith("og:") ? "property" : "name"}="${key}" content="${escape(value)}">`).join("\n")}
      <link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site.css">
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet">
      <style>.talk-page{padding-top:40px;padding-bottom:64px}.talk-page h1{font-size:32px;line-height:1.25;max-width:1000px}.talk-page .abstract-text{max-width:850px;line-height:1.75;margin:32px 0}.talk-page .archive-links{flex-wrap:wrap;margin-top:24px}.talk-page .share-status{margin-left:12px}.talk-page .talk-authors{line-height:1.6}</style></head><body>
      ${header}<main class="shell talk-page"><p class="eyebrow">${escape(date)}</p><h1>${escape(talk.title)}</h1>
      <p class="lead">Presented by ${escape(talk.presenter)}</p><p class="talk-authors">${escape(talk.authors)}</p>
      <div class="archive-links">${action("recording", talk.recordingUrl)}${action("paper", talk.paperUrl)}${action("Zoom", zoom)}${action("Schedule", "/season.html")}
      <button class="pill" type="button" id="copyTalkLink" style="cursor:pointer">Copy talk link</button><span id="shareStatus" class="share-status" role="status"></span></div>
      <div class="abstract-text"><h2>Abstract</h2><p>${escape(talk.abstract)}</p></div></main>${footer}
      <script>document.getElementById("copyTalkLink").addEventListener("click",async()=>{const status=document.getElementById("shareStatus");try{await navigator.clipboard.writeText(${JSON.stringify(url)});status.textContent="Link copied";}catch{status.textContent=${JSON.stringify(url)};}});</script></body></html>`;
    writeFileSync(join(output, `${id}.html`), html);
    manifest.push({ startIso: talk.startIso, socialTitle, description, imageUrl, imageAlt, url });
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest));
}
