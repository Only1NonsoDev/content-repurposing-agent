import type { Tone, Voice } from "./types";

const SWAPS: Record<string, string> = {
  leverage: "use",
  leveraging: "using",
  synergy: "teamwork",
  synergies: "shared wins",
  "circle back": "follow up",
  disrupt: "change",
  disruptive: "new",
  utilize: "use",
  utilizing: "using",
  delve: "look",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanListItem(value: string): string {
  return value
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseVoice(note: string): Voice {
  const raw = note.trim();
  const lower = raw.toLowerCase();

  let tone: Tone = "direct";
  if (/\b(warm|friendly|kind|gentle|human)\b/.test(lower)) tone = "warm";
  else if (/\b(formal|professional|executive|serious)\b/.test(lower)) tone = "formal";
  else if (/\b(bold|punchy|sharp|provocative)\b/.test(lower)) tone = "bold";
  else if (/\b(playful|fun|witty|light)\b/.test(lower)) tone = "playful";
  else if (/\b(direct|plain|practical|straightforward|clear)\b/.test(lower)) tone = "direct";

  const audienceMatch = raw.match(/\b(?:audience|talking to|readers?|for)\b\s*[:\-]?\s*([^\n.]+)/i);
  let audience = audienceMatch?.[1]?.trim() ?? null;
  if (audience) {
    audience = audience.split(/\b(?:avoid|don't say|do not say|words to avoid)\b/i)[0]?.trim() ?? null;
    audience = audience?.replace(/[.,;:\s]+$/, "") || null;
    if (audience && (audience.length < 3 || audience.length > 80)) audience = null;
  }

  const avoidMatch = raw.match(/\b(?:words to avoid|don't say|do not say|avoid)\b\s*[:\-]?\s*([^\n]+)/i);
  const avoid = avoidMatch
    ? avoidMatch[1]
        .split(/[,;/|]|\band\b/i)
        .map(cleanListItem)
        .filter((item) => item.length > 2 && item.length < 40)
        .filter((item) => !["the", "and", "for", "with", "your"].includes(item))
    : [];

  return {
    tone,
    audience,
    avoid: [...new Set(avoid)],
    raw,
  };
}

export function voiceSummary(voice: Voice): string {
  const tone = voice.tone.charAt(0).toUpperCase() + voice.tone.slice(1);
  const audience = voice.audience ? `Audience: ${voice.audience}.` : "No audience noted.";
  const count = voice.avoid.length;
  const avoid =
    count === 0
      ? "No words to skip."
      : `Skipping ${count} word${count === 1 ? "" : "s"} or phrase${count === 1 ? "" : "s"}.`;
  return `${tone} tone. ${audience} ${avoid}`;
}

export function scrub(text: string, avoid: string[]): string {
  const phrases = [...avoid].filter(Boolean).sort((a, b) => b.length - a.length);
  let out = text;
  for (const phrase of phrases) {
    const replacement = SWAPS[phrase.toLowerCase()] ?? "";
    const pattern = phrase.split(/\s+/).map(escapeRegExp).join("\\s+");
    out = out.replace(new RegExp(`\\b${pattern}\\b`, "gi"), replacement);
  }
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
