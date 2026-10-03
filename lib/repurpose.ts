import { extractClaims, splitDocument } from "./claims";
import { buildPack } from "./formats";
import type { Claim, Pack, RepurposeResponse, Step } from "./types";
import { flatten, wordCount } from "./text";
import { UserInputError } from "./safe-url";
import { parseVoice, voiceSummary } from "./voice";

const MAX_CHARS = 20_000;

export type LocalDraft = {
  title: string;
  wordCount: number;
  claims: Claim[];
  steps: Step[];
  pack: Pack;
  trimmed: boolean;
  sourceText: string;
};

export function repurposeLocal(source: string, voiceNote: string): LocalDraft {
  const cleaned = source.replace(/\0/g, "").trim();
  if (!cleaned) {
    throw new UserInputError("Paste an article or a public link first.");
  }

  const trimmed = cleaned.length > MAX_CHARS;
  const limited = trimmed ? cleaned.slice(0, MAX_CHARS) : cleaned;
  const { title, body } = splitDocument(limited);
  const count = wordCount(limited);
  if (count < 25) {
    throw new UserInputError("That text is too short. Paste a few paragraphs, or load the sample article.");
  }

  const claims = extractClaims(body);
  if (claims.length < 2) {
    throw new UserInputError("That text does not have enough clear sentences to repurpose. Paste a fuller article.");
  }

  const voice = parseVoice(voiceNote);
  const flatSource = flatten(`${title}\n${body}`);
  const pack = buildPack({ title, claims, voice, sourceText: flatSource });
  const numbered = claims.filter((claim) => claim.hasNumber).length;

  const steps: Step[] = [
    {
      id: "read",
      label: "Read the source",
      detail: `“${title}” · ${count} words${trimmed ? " · first 20,000 characters" : ""}`,
    },
    {
      id: "claims",
      label: "Pull claims and numbers",
      detail: `Kept ${claims.length} lines. ${numbered} of them include a number.`,
    },
    {
      id: "voice",
      label: "Apply the brand voice",
      detail: voiceSummary(voice),
    },
    {
      id: "draft",
      label: "Draft five native formats",
      detail: "Local rewrite. The same article and voice produce the same pack every time.",
    },
    {
      id: "notes",
      label: "Attach source notes",
      detail: "Each format lists the exact sentences it used.",
    },
  ];

  return {
    title,
    wordCount: count,
    claims,
    steps,
    pack,
    trimmed,
    sourceText: flatSource,
  };
}

export function toResponse(
  draft: LocalDraft,
  extras: { mode: RepurposeResponse["mode"]; model: string | null; sourceKind: RepurposeResponse["sourceKind"]; notice: string | null; pack?: Pack; steps?: Step[] },
): RepurposeResponse {
  return {
    mode: extras.mode,
    model: extras.model,
    title: draft.title,
    wordCount: draft.wordCount,
    sourceKind: extras.sourceKind,
    claims: draft.claims,
    steps: extras.steps ?? draft.steps,
    pack: extras.pack ?? draft.pack,
    notice: extras.notice,
  };
}
