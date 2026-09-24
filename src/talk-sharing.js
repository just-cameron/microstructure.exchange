export function nextTalk(talks, now = Date.now()) {
  return talks.filter(talk => Date.parse(talk.startIso) + 3600000 > now)
    .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))[0] || null;
}

export async function upcomingPreview(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const manifestUrl = new URL("/talks/manifest.json", request.url);
  const manifest = await env.ASSETS.fetch(new Request(manifestUrl));
  if (!manifest.ok) return response;
  const talk = nextTalk(await manifest.json());
  if (!talk) return response;
  const replacements = {
    "og:title": talk.socialTitle, "twitter:title": talk.socialTitle,
    "og:description": talk.description, "twitter:description": talk.description,
    "og:image": talk.imageUrl, "twitter:image": talk.imageUrl,
    "og:image:alt": talk.imageAlt, "twitter:image:alt": talk.imageAlt,
  };
  const updated = new HTMLRewriter().on("meta", {
    element(element) {
      const key = element.getAttribute("property") || element.getAttribute("name");
      if (replacements[key]) element.setAttribute("content", replacements[key]);
    }
  }).transform(response);
  updated.headers.set("Cache-Control", "no-cache");
  return updated;
}
