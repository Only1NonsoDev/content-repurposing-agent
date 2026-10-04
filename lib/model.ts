import { groundedNumbers, packPlainText } from "./formats";
import type { Claim, Pack, Slide, Voice } from "./types";

const MAX_POSTS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "string" && item.trim())) return null;
  return value.map((item) => item.trim());
}

function slides(value: unknown): Slide[] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const parsed: Slide[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.title !== "string" || typeof item.caption !== "string") return null;
    if (!item.title.trim() || !item.caption.trim()) return null;
    parsed.push({ title: item.title.trim(), caption: item.caption.trim() });
  }
  return parsed;
}

function claimIds(value: unknown, known: Set<string>): string[] | null {
  const list = stringList(value);
  if (!list || list.some((id) => !known.has(id))) return null;
  return [...new Set(list)];
}

export function parseModelPack(value: unknown, claims: Claim[]): Pack | null {
  if (!isRecord(value)) return null;
  const known = new Set(claims.map((claim) => claim.id));
  const linkedin = isRecord(value.linkedin) ? value.linkedin : null;
  const thread = isRecord(value.thread) ? value.thread : null;
  const instagram = isRecord(value.instagram) ? value.instagram : null;
  const email = isRecord(value.email) ? value.email : null;
  const video = isRecord(value.video) ? value.video : null;
  if (!linkedin || !thread || !instagram || !email || !video) return null;
  if (typeof linkedin.text !== "string" || !linkedin.text.trim()) return null;

  const posts = stringList(thread.posts);
  const deck = slides(instagram.slides);
  if (!posts || posts.length < 3 || posts.length > MAX_POSTS || !deck || deck.length > 8) return null;
  if (typeof email.subject !== "string" || typeof email.body !== "string" || typeof email.preheader !== "string") return null;
  if (!email.subject.trim() || !email.body.trim() || !email.preheader.trim()) return null;
  if (typeof video.script !== "string" || !/0:00/.test(video.script) || !/0:2\d/.test(video.script)) return null;

  const linkedinIds = claimIds(linkedin.claimIds, known);
  const threadIds = claimIds(thread.claimIds, known);
  const instagramIds = claimIds(instagram.claimIds, known);
  const emailIds = claimIds(email.claimIds, known);
  const videoIds = claimIds(video.claimIds, known);
  if (!linkedinIds || !threadIds || !instagramIds || !emailIds || !videoIds) return null;

  return {
    linkedin: { text: linkedin.text.trim(), claimIds: linkedinIds },
    thread: {
      posts: posts.map((post, index) => {
        const body = post.replace(/^\s*\d+\s*\/\s*/, "").trim();
        const numbered = `${index + 1}/ ${body}`;
        return numbered.length > 280 ? `${numbered.slice(0, 279).trim()}…` : numbered;
      }),
      claimIds: threadIds,
    },
    instagram: { slides: deck, claimIds: instagramIds },
    email: {
      subject: email.subject.trim(),
      preheader: email.preheader.trim(),
      body: email.body.trim(),
      claimIds: emailIds,
    },
    video: { script: video.script.trim(), claimIds: videoIds },
  };
}

export function modelPackProblem(pack: Pack, source: string, voice: Voice): string | null {
  if (!groundedNumbers(pack, source)) {
    return "The model added a number that is not in the source, so this pack uses the local demo rewrite.";
  }
  const plain = packPlainText(pack);
  const banned = voice.avoid.find((phrase) => phrasePattern(phrase).test(plain));
  if (banned) {
    return `The model used “${banned}”, which your voice note says to skip, so this pack uses the local demo rewrite.`;
  }
  if (pack.thread.posts.some((post) => post.length > 280)) {
    return "The thread ran past the X character limit, so this pack uses the local demo rewrite.";
  }
  return null;
}

function phrasePattern(phrase: string): RegExp {
  const body = phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${body}\\b`, "i");
}

export async function draftWithModel(input: {
  title: string;
  sourceText: string;
  claims: Claim[];
  voice: Voice;
  apiKey: string;
  model: string;
}): Promise<unknown> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You rewrite one source article into native channel copy.",
            "Use only facts and numbers present in the source or the claim list. Never invent statistics, customers, or quotes.",
            "Respect the brand voice. Do not use the avoid list.",
            "LinkedIn needs a hook, short lines or bullets, a closing question, and at most 3 hashtags drawn from source words.",
            "The X thread needs 4 to 6 posts. Each post starts with 1/ style numbering, stays under 280 characters, and holds one idea.",
            "Instagram needs 5 or 6 slides. Each slide has a short title and a one- or two-sentence caption. One idea per slide.",
            "Email needs a subject under 50 characters, a preheader, and a short body under 120 words with one ask.",
            "The video script is spoken, about 70 words, with timestamps 0:00–0:03, 0:03–0:12, 0:12–0:22, 0:22–0:27, and 0:27–0:30. Open on a number from the source when one exists.",
            "The five formats must not be the same paragraph.",
            "claimIds must be ids from the claim list.",
            'Return JSON only: {"linkedin":{"text":"","claimIds":[]},"thread":{"posts":[],"claimIds":[]},"instagram":{"slides":[{"title":"","caption":""}],"claimIds":[]},"email":{"subject":"","preheader":"","body":"","claimIds":[]},"video":{"script":"","claimIds":[]}}',
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            title: input.title,
            voice: input.voice,
            claims: input.claims,
            source: input.sourceText.slice(0, 12000),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model status ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Model returned an empty message");
  return JSON.parse(content) as unknown;
}
