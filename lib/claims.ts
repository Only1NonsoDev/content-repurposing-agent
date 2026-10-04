import type { Claim } from "./types";
import { jaccard, splitSentences, wordCount } from "./text";

type Scored = {
  text: string;
  index: number;
  score: number;
  hasNumber: boolean;
};

function scoreSentence(text: string, index: number, total: number): number {
  const words = wordCount(text);
  if (words < 8 || words > 70) return 0;
  let score = 1;
  if (words >= 12 && words <= 38) score += 2;
  if (words > 46) score -= 2;
  if (/\d/.test(text)) score += 3;
  if (/\b(percent|%|times|hours?)\b/i.test(text)) score += 4;
  if (/\b(more often|more likely|outperformed|median|held|saved|cut)\b/i.test(text)) score += 1;
  if (/\b(we timed|in our sample|for example)\b/i.test(text)) score -= 1;
  if (index === total - 1) score += 0.4;
  return score;
}

function isInstruction(text: string): boolean {
  return /^(highlight|start|give|write|pick|select|keep|stop|open)\b/i.test(text) && wordCount(text) >= 8;
}

export function extractClaims(body: string): Claim[] {
  const sentences = splitSentences(body);
  const scored: Scored[] = sentences.map((text, index) => ({
    text,
    index,
    score: scoreSentence(text, index, sentences.length),
    hasNumber: /\d/.test(text),
  }));

  const ranked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: Scored[] = [];

  for (const sentence of ranked) {
    if (picked.length >= 5) break;
    if (sentence.score < 3 && picked.length >= 2) break;
    if (sentence.score <= 0) continue;
    if (picked.some((item) => jaccard(item.text, sentence.text) > 0.62)) continue;
    picked.push(sentence);
  }

  const instruction =
    [...scored].reverse().find((sentence) => sentence.score > 0 && /^highlight\b/i.test(sentence.text)) ??
    [...scored].reverse().find((sentence) => sentence.score > 0 && isInstruction(sentence.text));
  if (instruction && !picked.some((item) => item.index === instruction.index)) {
    picked.push(instruction);
  }

  if (picked.length < 2) {
    for (const sentence of ranked) {
      if (picked.length >= 3) break;
      if (wordCount(sentence.text) < 8) continue;
      if (picked.some((item) => item.index === sentence.index)) continue;
      picked.push(sentence);
    }
  }

  picked.sort((a, b) => a.index - b.index);
  return picked.slice(0, 6).map((sentence, index) => ({
    id: `c${index + 1}`,
    text: sentence.text,
    hasNumber: sentence.hasNumber,
  }));
}

export function splitDocument(raw: string): { title: string; body: string } {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2 && lines[0].length <= 110 && !/[.!?]$/.test(lines[0]) && wordCount(lines[0]) <= 16) {
    return { title: lines[0], body: lines.slice(1).join("\n") };
  }

  const sentences = splitSentences(text);
  const first = sentences[0] ?? "Untitled source";
  const title = first.split(/\s+/).slice(0, 12).join(" ").replace(/[.!?]$/, "");
  return { title, body: text };
}
