import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { nextTalk } from "../src/talk-sharing.js";

const talks = JSON.parse(readFileSync(new URL("../.deploy/public/talks/manifest.json", import.meta.url)));
test("preview advances at the end of the webinar, including daylight saving time", () => {
  assert.match(nextTalk(talks, Date.parse("2026-09-24T12:00:00Z")).socialTitle, /Drissi/);
  assert.match(nextTalk(talks, Date.parse("2026-09-29T15:59:59Z")).socialTitle, /Drissi/);
  assert.match(nextTalk(talks, Date.parse("2026-09-29T16:00:00Z")).socialTitle, /Galati/);
  assert.match(nextTalk(talks, Date.parse("2026-11-10T16:59:59Z")).socialTitle, /Foucault/);
  assert.match(nextTalk(talks, Date.parse("2026-11-10T17:00:00Z")).socialTitle, /Menkveld/);
  assert.equal(nextTalk(talks, Date.parse("2026-12-08T17:00:00Z")), null);
  assert.equal(nextTalk([], Date.now()), null);
});
test("every permanent page has its own canonical URL and matching image", () => {
  for (const talk of talks) {
    const id = talk.startIso.slice(0, 10);
    const html = readFileSync(new URL(`../.deploy/public/talks/${id}.html`, import.meta.url), "utf8");
    assert.ok(html.includes(`rel="canonical" href="${talk.url}"`));
    assert.ok(html.includes(`property="og:image" content="${talk.imageUrl}"`));
    assert.ok(html.includes("Copy talk link"));
    assert.ok(existsSync(new URL(`../.deploy/public${new URL(talk.imageUrl).pathname}`, import.meta.url)));
  }
});
