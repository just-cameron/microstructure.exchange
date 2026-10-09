import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { nextTalk } from "../src/talk-sharing.js";
import vm from "node:vm";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTalkSharing } from "./build-talk-sharing.js";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const schedule = JSON.parse(home.match(/const seasonTalks = (\[.*?\]);/s)[1]);
const escape = value => value.replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));

test("every announcement includes its complete abstract, expanded by default", () => {
  for (const talk of schedule) {
    assert.ok(talk.abstract?.trim(), `Missing abstract for ${talk.presenter}`);
    const html = readFileSync(new URL(`../.deploy/public/talks/${talk.startIso.slice(0,10)}.html`, import.meta.url), "utf8");
    assert.ok(html.includes(`<div class="abstract-text"><h2>Abstract</h2><p>${escape(talk.abstract)}</p></div>`));
  }
});

test("an open homepage advances both presenter and complete visible abstract after each talk", () => {
  let now = Date.parse(schedule[0].startIso) - 1000;
  const elements = Object.fromEntries(["webinarCountdown", "nextTalkDetails", "nextTalkActions", "nextTalkAbstract"].map(id => [id, {innerHTML:"",hidden:false}]));
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({Date:Clock,Intl,document:{querySelector:selector=>elements[selector.slice(1)]},window:{setInterval(){}}});
  const script = [...home.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("const seasonTalks"))[1];
  vm.runInContext(script, context);
  for (const talk of schedule) {
    assert.ok(elements.nextTalkDetails.innerHTML.includes(escape(talk.presenter)));
    assert.ok(elements.nextTalkAbstract.innerHTML.includes(escape(talk.abstract)));
    assert.equal(elements.nextTalkAbstract.hidden,false);
    now = Date.parse(talk.startIso) + 3600000;
    vm.runInContext("updateCountdown()",context);
  }
  assert.equal(elements.nextTalkAbstract.hidden,true);
  assert.ok(elements.nextTalkDetails.innerHTML.includes("Next season to be announced"));
});

test("publication fails when a scheduled talk has no abstract", async () => {
  const directory = mkdtempSync(join(tmpdir(), "tme-abstract-test-"));
  try {
    const incomplete = schedule.map((talk,i)=>i===0?{...talk,abstract:" "}:talk);
    writeFileSync(join(directory,"index.html"),home.replace(/const seasonTalks = (\[.*?\]);/s,()=>`const seasonTalks = ${JSON.stringify(incomplete)};`));
    await assert.rejects(buildTalkSharing(directory), /Missing announcement abstract/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

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
