export type Tone = "direct" | "warm" | "formal" | "bold" | "playful";

export type Voice = {
  tone: Tone;
  audience: string | null;
  avoid: string[];
  raw: string;
};

export type Claim = {
  id: string;
  text: string;
  hasNumber: boolean;
};

export type Slide = {
  title: string;
  caption: string;
};

export type Pack = {
  linkedin: { text: string; claimIds: string[] };
  thread: { posts: string[]; claimIds: string[] };
  instagram: { slides: Slide[]; claimIds: string[] };
  email: {
    subject: string;
    preheader: string;
    body: string;
    claimIds: string[];
  };
  video: { script: string; claimIds: string[] };
};

export type Step = {
  id: string;
  label: string;
  detail: string;
};

export type RepurposeResponse = {
  mode: "demo" | "model";
  model: string | null;
  title: string;
  wordCount: number;
  sourceKind: "paste" | "url";
  claims: Claim[];
  steps: Step[];
  pack: Pack;
  notice: string | null;
};
