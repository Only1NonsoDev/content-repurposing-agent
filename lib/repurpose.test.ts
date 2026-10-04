import assert from "node:assert/strict";
import test from "node:test";

import { htmlToArticle } from "./html";
import { modelPackProblem, parseModelPack } from "./model";
import { groundedNumbers, packPlainText, spokenWordCount } from "./formats";
import { repurposeLocal } from "./repurpose";
import { SAMPLE_ARTICLE, SAMPLE_VOICE } from "./sample";
import { isBlockedIp, parsePublicUrl, UserInputError } from "./safe-url";
import { flatten } from "./text";
import { parseVoice } from "./voice";

test("sample article becomes five native formats", () => {
  const draft = repurposeLocal(SAMPLE_ARTICLE, SAMPLE_VOICE);
  const { pack } = draft;

  assert.equal(draft.title, "One blog post, five hours gone");
  assert.ok(draft.claims.length >= 5);
  assert.ok(draft.claims.some((claim) => claim.text.includes("4.5 hours")));
  assert.ok(draft.claims.some((claim) => claim.text.includes("2.1 times")));
  assert.ok(draft.claims.some((claim) => claim.text.includes("38 percent")));
  assert.ok(draft.claims.some((claim) => claim.text.includes("42 characters")));
  assert.ok(draft.claims.some((claim) => claim.text.includes("2.4 times")));
  assert.ok(draft.claims.some((claim) => /Highlight five sentences/.test(claim.text)));

  const flat = flatten(SAMPLE_ARTICLE);
  for (const claim of draft.claims) {
    assert.ok(flat.includes(claim.text), `claim not in source: ${claim.text}`);
  }

  assert.match(pack.linkedin.text, /4\.5 hours/);
  assert.match(pack.linkedin.text, /• /);
  assert.match(pack.linkedin.text, /content marketers at B2B startups/);
  assert.match(pack.linkedin.text, /#/);
  assert.doesNotMatch(pack.linkedin.text, /\bswipe\b/i);

  assert.ok(pack.thread.posts.length >= 4 && pack.thread.posts.length <= 6);
  pack.thread.posts.forEach((post, index) => {
    assert.match(post, new RegExp(`^${index + 1}/ `));
    assert.ok(post.length <= 280, post);
  });
  assert.match(pack.thread.posts.join("\n"), /%/);
  assert.match(pack.thread.posts.at(-1) ?? "", /Source:/);

  assert.ok(pack.instagram.slides.length >= 5);
  for (const slide of pack.instagram.slides) {
    assert.ok(slide.title.length > 0);
    assert.ok(slide.caption.length > 0);
  }
  assert.match(pack.instagram.slides[0]?.caption ?? "", /Swipe/);
  assert.ok(pack.instagram.slides.some((slide) => slide.title === "4.5 hours"));

  assert.ok(pack.email.subject.length > 0);
  assert.ok(pack.email.subject.length <= 52);
  assert.match(pack.email.body, /^Hi,/);
  assert.match(pack.email.body, /42 characters/);
  assert.ok(pack.email.preheader.length > 0);
  assert.notEqual(pack.email.preheader, pack.email.subject);

  assert.match(pack.video.script, /0:00/);
  assert.match(pack.video.script, /0:27/);
  assert.match(pack.video.script, /2\.4/);
  const spoken = spokenWordCount(pack.video.script);
  assert.ok(spoken >= 45 && spoken <= 110, `spoken words: ${spoken}`);

  assert.notEqual(pack.linkedin.text, pack.email.body);
  assert.notEqual(pack.linkedin.text, pack.thread.posts.join("\n\n"));
  assert.ok(groundedNumbers(pack, draft.sourceText));

  const again = repurposeLocal(SAMPLE_ARTICLE, SAMPLE_VOICE);
  assert.deepEqual(again.pack, pack);
});

test("voice note removes words the user said to avoid", () => {
  const source = `A short field note about drafts

The median team spent 4.5 hours trying to leverage synergy across one article and still missed the deadline. Threads with six posts or fewer were 2.1 times more likely to be completed than longer threads in the same study. Highlight five sentences before you open any other tab and give each channel a different job.
`;
  const draft = repurposeLocal(source, "Warm. Audience: solo consultants. Avoid: synergy, leverage, circle back.");
  const plain = packPlainText(draft.pack);
  assert.doesNotMatch(plain, /\bleverage\b/i);
  assert.doesNotMatch(plain, /\bsynergy\b/i);
  assert.match(plain, /teamwork/);
  assert.match(plain, /solo consultants/);
  assert.match(draft.pack.email.body, /^Hi,/);
  assert.ok(draft.claims.some((claim) => /leverage/.test(claim.text)));
});

test("short text is rejected in plain language", () => {
  assert.throws(() => repurposeLocal("Too short to use.", ""), UserInputError);
});

test("brand voice parsing", () => {
  const voice = parseVoice(SAMPLE_VOICE);
  assert.equal(voice.tone, "direct");
  assert.equal(voice.audience, "content marketers at B2B startups");
  assert.deepEqual(voice.avoid, ["synergy", "leverage", "circle back"]);
});

test("private addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.8", "172.16.0.4", "169.254.1.1", "::1", "::ffff:127.0.0.1"]) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  assert.equal(isBlockedIp("1.1.1.1"), false);
  assert.equal(isBlockedIp("8.8.8.8"), false);
  assert.throws(() => parsePublicUrl("http://127.0.0.1/secret"), UserInputError);
  assert.throws(() => parsePublicUrl("file:///etc/passwd"), UserInputError);
  assert.throws(() => parsePublicUrl("http://localhost:3000"), UserInputError);
});

test("html extraction keeps the article text", () => {
  const article = htmlToArticle(`
    <html><head><title>Ignored title</title><style>body{color:red}</style></head>
    <body><nav>Home Pricing</nav><header><h1>Launch notes</h1></header>
    <article><p>The median team spent 4.5 hours turning that single article into channel copy for the launch.</p>
    <p>Threads with six posts or fewer were 2.1 times more likely to be completed than longer threads in the study.</p>
    <script>alert("nope")</script></article></body></html>
  `);
  assert.equal(article.title, "Launch notes");
  assert.match(article.text, /4\.5 hours/);
  assert.doesNotMatch(article.text, /alert/);
  assert.doesNotMatch(article.text, /Pricing/);
});

test("model output with a new number is rejected", () => {
  const draft = repurposeLocal(SAMPLE_ARTICLE, SAMPLE_VOICE);
  const pack = parseModelPack(
    {
      linkedin: { text: "Teams grew 99 percent overnight.", claimIds: [draft.claims[0]?.id] },
      thread: { posts: ["1/ Teams grew 99 percent overnight.", "2/ Another line from the source stays here.", "3/ Last post."], claimIds: [draft.claims[0]?.id] },
      instagram: {
        slides: [
          { title: "99%", caption: "Teams grew 99 percent overnight." },
          { title: "Next", caption: "A second slide." },
          { title: "Last", caption: "A third slide." },
        ],
        claimIds: [draft.claims[0]?.id],
      },
      email: { subject: "Overnight", preheader: "A note", body: "Teams grew 99 percent overnight.", claimIds: [draft.claims[0]?.id] },
      video: { script: "0:00 HOOK\n\"99 percent.\"\n0:27 CLOSE\n\"Stop.\"", claimIds: [draft.claims[0]?.id] },
    },
    draft.claims,
  );
  assert.ok(pack);
  const problem = modelPackProblem(pack, draft.sourceText, parseVoice(SAMPLE_VOICE));
  assert.match(problem ?? "", /number that is not in the source/);
});
