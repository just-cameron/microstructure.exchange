export function nextTalk(talks, now = Date.now()) {
  return talks.filter(talk => Date.parse(talk.startIso) + 3600000 > now)
    .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))[0] || null;
}

// Writes the build-time rendering of the "Next webinar" box into the page, so
// visitors and crawlers that do not run JavaScript see the current talk too.
export function withHomepageBox(rewriter, box) {
  if (!box) return rewriter;
  const fill = html => ({ element(element) { element.setInnerContent(html, { html: true }); } });
  return rewriter
    .on("#nextTalkDetails", fill(box.details))
    .on("#nextTalkActions", fill(box.actions))
    .on("#nextTalkAbstract", {
      element(element) {
        element.setInnerContent(box.abstract, { html: true });
        if (box.abstractHidden) element.setAttribute("hidden", "");
        else element.removeAttribute("hidden");
      }
    });
}

async function fetchJson(request, env, path) {
  const response = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  return response.ok ? response.json() : null;
}

export async function upcomingPreview(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const manifest = await fetchJson(request, env, "/talks/manifest.json");
  if (!manifest) return response;
  const talk = nextTalk(manifest);
  let rewriter = new HTMLRewriter();
  if (talk) {
    const replacements = {
      "og:title": talk.socialTitle, "twitter:title": talk.socialTitle,
      "og:description": talk.description, "twitter:description": talk.description,
      "og:image": talk.imageUrl, "twitter:image": talk.imageUrl,
      "og:image:alt": talk.imageAlt, "twitter:image:alt": talk.imageAlt,
    };
    rewriter = rewriter.on("meta", {
      element(element) {
        const key = element.getAttribute("property") || element.getAttribute("name");
        if (replacements[key]) element.setAttribute("content", replacements[key]);
      }
    });
  }
  const box = talk ? talk.home : await fetchJson(request, env, "/talks/home-complete.json");
  rewriter = withHomepageBox(rewriter, box);
  const updated = rewriter.transform(response);
  updated.headers.set("Cache-Control", "no-cache");
  return updated;
}
