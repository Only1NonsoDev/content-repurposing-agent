import type { Claim, Pack, Tone, Voice } from "./types";
import {
  clipChars,
  clipWords,
  contractions,
  ensurePeriod,
  numberPhrase,
  titleCase,
  unique,
  withSymbolPercents,
  withWordPercents,
  wordCount,
} from "./text";
import { scrub } from "./voice";

export type Brief = {
  title: string;
  claims: Claim[];
  voice: Voice;
  sourceText: string;
};

const GENERIC = new Set([
  "that",
  "this",
  "with",
  "from",
  "your",
  "about",
  "into",
  "have",
  "were",
  "been",
  "they",
  "them",
  "just",
  "more",
  "than",
  "when",
  "what",
  "which",
  "their",
  "there",
  "would",
  "could",
  "should",
  "article",
  "blog",
  "post",
  "posts",
  "team",
  "teams",
  "time",
  "content",
  "single",
  "whole",
  "because",
  "after",
  "before",
  "where",
  "while",
  "these",
  "those",
  "each",
  "other",
  "only",
  "most",
  "same",
  "week",
  "people",
]);

function hookRank(claim: Claim): number {
  let score = claim.hasNumber ? 2 : 0;
  if (/\b(percent|%|times|hours?)\b/i.test(claim.text)) score += 3;
  if (/\b(we timed|in our sample)\b/i.test(claim.text)) score -= 2;
  return score;
}

function pickHook(claims: Claim[]): Claim {
  return [...claims].sort((a, b) => hookRank(b) - hookRank(a))[0] ?? claims[0];
}

function supporting(claims: Claim[], hook: Claim): Claim[] {
  return claims.filter((claim) => claim.id !== hook.id);
}

function actionClaim(claims: Claim[], hook: Claim): Claim | null {
  const pool = claims.filter((claim) => claim.id !== hook.id);
  return (
    [...pool].reverse().find((claim) => /^highlight\b/i.test(claim.text)) ??
    [...pool].reverse().find((claim) => /^(start|give|write|pick|select|keep|stop|open)\b/i.test(claim.text)) ??
    pool.at(-1) ??
    null
  );
}

function spoken(text: string, tone: Tone): string {
  const base = tone === "formal" ? text : contractions(text);
  return tone === "formal" ? withWordPercents(base) : withSymbolPercents(base);
}

function tighten(sentence: string): string {
  let next = sentence.replace(/\s+/g, " ").trim();
  next = next.replace(/^(and|but|so)\b[, ]*/i, "");
  return ensurePeriod(next);
}

function audienceLine(voice: Voice): string | null {
  if (!voice.audience) return null;
  if (voice.tone === "bold") return `${voice.audience}: this is the part worth keeping.`;
  if (voice.tone === "playful") return `A note for ${voice.audience}.`;
  if (voice.tone === "warm") return `Written with ${voice.audience} in mind.`;
  return `For ${voice.audience}.`;
}

function bridge(tone: Tone): string {
  switch (tone) {
    case "warm":
      return "The useful part, in plain words:";
    case "formal":
      return "Points supported by the source:";
    case "bold":
      return "Keep these lines. Cut the rest:";
    case "playful":
      return "The lines worth keeping, with the source attached:";
    default:
      return "What the article actually says:";
  }
}

function cta(tone: Tone): string {
  switch (tone) {
    case "warm":
      return "Which line would be most useful to your readers this week?";
    case "formal":
      return "Which point should lead the next draft?";
    case "bold":
      return "Pick one claim. Write one post. Leave the article where it is.";
    case "playful":
      return "Which line gets the first draft?";
    default:
      return "Which of these claims would you rewrite first?";
  }
}

function hashtags(title: string, claims: Claim[], avoid: string[]): string[] {
  const counts = new Map<string, number>();
  const source = `${title} ${claims.map((claim) => claim.text).join(" ")}`;
  for (const word of source.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (GENERIC.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const skip = new Set([
    ...GENERIC,
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "hours",
    "hour",
    "times",
    "percent",
    "characters",
    "character",
    "seconds",
    "second",
    "lines",
    "line",
    "draft",
    "drafts",
    "single",
    "whole",
  ]);
  const tags: string[] = [];
  const rankedWords = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [word, count] of rankedWords) {
    if (count < 2 || word.length < 6 || skip.has(word)) continue;
    if (avoid.some((phrase) => word.includes(phrase.split(" ")[0] ?? phrase))) continue;
    tags.push(`#${word.replace(/-/g, "")}`);
    if (tags.length === 3) break;
  }
  return tags;
}

function nativeLine(value: string): string {
  const stripped = value.replace(/^(On Instagram,\s+|In our sample,\s+)/i, "").trim();
  if (!stripped) return stripped;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function slideTitle(claim: string): string {
  const hours = claim.match(/(\d+(?:\.\d+)?)\s+hours?/i);
  if (hours) return `${hours[1]} hours`;
  const times = claim.match(/(\d+(?:\.\d+)?)\s+times/i);
  if (times) return `${times[1]}×`;
  const percent = claim.match(/(\d+(?:\.\d+)?)\s+percent/i);
  if (percent) return `${percent[1]}%`;
  const chars = claim.match(/(\d+(?:\.\d+)?)\s+characters?/i);
  if (chars) return `${chars[1]} characters`;
  const seconds = claim.match(/(\d+(?:\.\d+)?)-second/i);
  if (seconds) return `${seconds[1]} seconds`;
  return titleCase(clipWords(claim.replace(/[.!?]$/, ""), 5));
}

function emailSubject(title: string): string {
  const clean = title.replace(/[.!?]$/, "").trim();
  if (clean.length >= 8 && clean.length <= 52) return clean;
  return clipChars(clipWords(clean, 8), 52).replace(/\.$/, "");
}

function usable(text: string): boolean {
  return wordCount(text) >= 3;
}

function prefer(claims: Claim[], pattern: RegExp, fallback: Claim): Claim {
  return claims.find((claim) => pattern.test(claim.text)) ?? fallback;
}

function openOnNumber(sentence: string, tone: Tone): string {
  const line = spoken(tighten(sentence), tone);
  const num = numberPhrase(sentence);
  if (!num) return line;
  const pattern = new RegExp(num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const early = line.split(/\s+/).slice(0, 8).join(" ");
  if (pattern.test(early)) return line;
  return `${num}. ${clipWords(line, 16)}`;
}

export function buildPack(brief: Brief): Pack {
  const { title, claims, voice } = brief;
  const hook = pickHook(claims);
  if (!hook) {
    throw new Error("No claims to draft from.");
  }
  const rest = supporting(claims, hook);
  const action = actionClaim(claims, hook);
  const proof = rest.filter((claim) => claim.id !== action?.id);
  const linkedinClaims = unique([...proof.slice(0, 3), ...(action ? [action] : [])].map((claim) => claim.id));
  const linkedinLines = linkedinClaims
    .map((id) => claims.find((claim) => claim.id === id))
    .filter((claim): claim is Claim => Boolean(claim))
    .map((claim) => `• ${tighten(withWordPercents(claim.text))}`)
    .filter(usable);

  const linkedinParts = [clipChars(tighten(withWordPercents(hook.text)), 200), ""];
  const who = audienceLine(voice);
  if (who) linkedinParts.push(who, "");
  linkedinParts.push(bridge(voice.tone), "", ...linkedinLines, "");
  linkedinParts.push(cta(voice.tone));
  const tags = hashtags(title, claims, voice.avoid);
  if (tags.length) linkedinParts.push("", tags.join(" "));
  const linkedin = scrub(linkedinParts.join("\n"), voice.avoid);

  const threadClaims = unique([hook.id, ...proof.slice(0, 3).map((claim) => claim.id), ...(action ? [action.id] : [])]);
  const threadPosts = threadClaims.map((id, index) => {
    const claim = claims.find((item) => item.id === id);
    const trimmed = claim ? nativeLine(claim.text) : "";
    const line = trimmed ? clipChars(spoken(tighten(trimmed), voice.tone), 250) : "";
    return `${index + 1}/ ${line}`.trim();
  });
  threadPosts.push(`${threadPosts.length + 1}/ Source: ${clipChars(title, 180)}. One article, a different job for each channel.`);
  const thread = threadPosts.map((post) => clipChars(scrub(post, voice.avoid), 280));

  const slides: Pack["instagram"]["slides"] = [
    {
      title: titleCase(clipWords(title, 8)),
      caption: scrub(
        `${voice.audience ? `For ${voice.audience}. ` : ""}Swipe for the claims worth posting. One idea per slide.`,
        voice.avoid,
      ),
    },
  ];
  const instagramClaims = unique([hook.id, ...proof.map((claim) => claim.id)]).slice(0, 5);
  for (const id of instagramClaims) {
    const claim = claims.find((item) => item.id === id);
    if (!claim) continue;
    const caption = clipChars(spoken(tighten(nativeLine(claim.text)), voice.tone), 200);
    if (!usable(caption)) continue;
    slides.push({
      title: slideTitle(claim.text),
      caption: scrub(caption, voice.avoid),
    });
  }
  if (action) {
    slides.push({
      title: "Start here",
      caption: scrub(clipChars(spoken(tighten(action.text), voice.tone), 200), voice.avoid),
    });
  }

  const subject = scrub(emailSubject(title), voice.avoid);
  const emailProof = prefer(proof, /subject|email|newsletter/i, proof[0] ?? hook);
  const preheaderSource = proof.find((claim) => claim.id !== emailProof.id) ?? emailProof;
  const preheader = scrub(clipChars(spoken(tighten(preheaderSource.text), voice.tone), 110), voice.avoid);
  const greeting = voice.tone === "formal" ? "Hello," : voice.tone === "playful" ? "Hey," : "Hi,";
  const emailBodyParts = [greeting, ""];
  if (voice.audience) emailBodyParts.push(`This note is for ${voice.audience}.`, "");
  emailBodyParts.push(tighten(withWordPercents(hook.text)), "");
  if (emailProof.id !== hook.id) {
    emailBodyParts.push(`One detail to keep: ${tighten(withWordPercents(emailProof.text))}`, "");
  }
  if (action) emailBodyParts.push(tighten(withWordPercents(action.text)), "");
  emailBodyParts.push(cta(voice.tone));
  if (voice.tone === "warm") emailBodyParts.push("", "Hope it saves you a rewrite.");
  if (voice.tone === "formal") emailBodyParts.push("", "Regards,");
  const emailBody = scrub(emailBodyParts.join("\n"), voice.avoid);

  const videoClaims = {
    hook,
    why: proof[0] ?? hook,
    proof: prefer(proof, /video|viewer|script|second/i, proof[1] ?? proof[0] ?? hook),
    move: action ?? hook,
  };
  const beats = [
    ["0:00–0:03", "HOOK", clipWords(openOnNumber(videoClaims.hook.text, voice.tone), 22)],
    ["0:03–0:12", "WHY IT MATTERS", clipWords(spoken(tighten(videoClaims.why.text), voice.tone), 20)],
    ["0:12–0:22", "PROOF", clipWords(spoken(tighten(videoClaims.proof.text), voice.tone), 32)],
    ["0:22–0:27", "THE MOVE", clipWords(spoken(tighten(videoClaims.move.text), voice.tone), 16)],
    ["0:27–0:30", "CLOSE", clipWords(spoken(cta(voice.tone), voice.tone), 14)],
  ] as const;
  const script = scrub(
    [
      "30-SECOND SCRIPT",
      "",
      ...beats.flatMap(([time, label, line]) => [`${time}  ${label}`, `"${ensurePeriod(line)}"`, ""]),
      "Read it aloud once. If you pass 30 seconds, cut the proof line first.",
    ].join("\n"),
    voice.avoid,
  );

  const videoIds = unique([videoClaims.hook.id, videoClaims.why.id, videoClaims.proof.id, videoClaims.move.id]);

  return {
    linkedin: { text: linkedin, claimIds: unique([hook.id, ...linkedinClaims]) },
    thread: { posts: thread.filter((post) => post.length > 3), claimIds: threadClaims },
    instagram: { slides, claimIds: instagramClaims },
    email: {
      subject,
      preheader,
      body: emailBody,
      claimIds: unique([hook.id, emailProof.id, preheaderSource.id, ...(action ? [action.id] : [])]),
    },
    video: { script, claimIds: videoIds },
  };
}

export function spokenWordCount(script: string): number {
  const quotes = [...script.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
  return wordCount(quotes.join(" "));
}

export function numbersIn(value: string): string[] {
  return value.match(/\d+(?:\.\d+)?/g) ?? [];
}

export function packPlainText(pack: Pack): string {
  return [
    pack.linkedin.text,
    pack.thread.posts.join("\n"),
    pack.instagram.slides.map((slide) => `${slide.title} ${slide.caption}`).join("\n"),
    `${pack.email.subject}\n${pack.email.preheader}\n${pack.email.body}`,
    pack.video.script,
  ].join("\n");
}

export function groundedNumbers(pack: Pack, source: string): boolean {
  const allowed = new Set(numbersIn(source));
  allowed.add("30");
  const stripped = packPlainText(pack)
    .replace(/\b\d+\//g, " ")
    .replace(/\b\d+:\d+\b/g, " ");
  return numbersIn(stripped).every((number) => allowed.has(number));
}
