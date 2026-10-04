export function wordCount(value: string): number {
  const words = value.trim().match(/[A-Za-z0-9][A-Za-z0-9''.%+-]*/g);
  return words ? words.length : 0;
}

export function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function flatten(value: string): string {
  return normalize(value).replace(/\s+/g, " ").trim();
}

export function splitSentences(value: string): string[] {
  const flat = flatten(value);
  if (!flat) return [];
  return flat
    .split(/(?<=[.!?])\s+(?=[“"(\[]?[A-Z0-9])/g)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function ensurePeriod(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function clipChars(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, Math.max(0, max - 1));
  const breaks = [slice.lastIndexOf(". "), slice.lastIndexOf("; "), slice.lastIndexOf(", "), slice.lastIndexOf(" ")];
  const cut = Math.max(...breaks);
  const base = (cut > 40 ? slice.slice(0, cut) : slice).replace(/[,:;–—-]\s*$/, "").trim();
  if (!base) return clean.slice(0, max).trim();
  return /[.!?]$/.test(base) ? base : `${base}.`;
}

export function clipWords(value: string, maxWords: number): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words
    .slice(0, maxWords)
    .join(" ")
    .replace(/[,:;]\s*$/, "");
}

export function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9']+/g) ?? []);
}

export function jaccard(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function numberPhrase(sentence: string): string | null {
  const match = sentence.match(
    /\b\d+(?:\.\d+)?\s*(?:percent|%|hours?|times|characters?|posts?|seconds?|minutes?)?/i,
  );
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

export function withSymbolPercents(value: string): string {
  return value.replace(/(\d+(?:\.\d+)?)\s+percent/gi, "$1%");
}

export function withWordPercents(value: string): string {
  return value.replace(/(\d+(?:\.\d+)?)%/g, "$1 percent");
}

export function contractions(value: string): string {
  return value
    .replace(/\b[Dd]o not\b/g, "don't")
    .replace(/\b[Dd]id not\b/g, "didn't")
    .replace(/\b[Cc]annot\b/g, "can't")
    .replace(/\b[Ww]ill not\b/g, "won't")
    .replace(/\b[Ii]t is\b/g, "it's")
    .replace(/\b[Tt]hat is\b/g, "that's")
    .replace(/\b[Tt]here is\b/g, "there's")
    .replace(/\b[Ww]e are\b/g, "we're")
    .replace(/\b[Yy]ou are\b/g, "you're")
    .replace(/\b[Ii]s not\b/g, "isn't")
    .replace(/\b[Aa]re not\b/g, "aren't");
}

const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "from"]);

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (/^\d/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
