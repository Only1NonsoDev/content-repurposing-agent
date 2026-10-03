import { fetchArticle } from "@/lib/fetch-article";
import { draftWithModel, modelPackProblem, parseModelPack } from "@/lib/model";
import { repurposeLocal, toResponse } from "@/lib/repurpose";
import { UserInputError } from "@/lib/safe-url";
import type { Step } from "@/lib/types";
import { parseVoice } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function looksLikeLoneUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

export async function GET(): Promise<Response> {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return json({ mode: key ? "model" : "demo", model: key ? model : null });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Send the article as JSON." }, 400);
  }

  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const pasted = typeof body.source === "string" ? body.source : "";
  const link = typeof body.url === "string" ? body.url.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : "";

  try {
    let source = pasted.trim();
    let sourceKind: "paste" | "url" = "paste";
    let ignoredLink = false;

    if (source && looksLikeLoneUrl(source) && !link) {
      sourceKind = "url";
      const article = await fetchArticle(source);
      source = article.text;
    } else if (!source && link) {
      sourceKind = "url";
      const article = await fetchArticle(link);
      source = article.text;
    } else if (!source && !link) {
      throw new UserInputError("Paste an article or a public link first.");
    } else if (source && link) {
      ignoredLink = true;
    }

    const draft = repurposeLocal(source, voice);
    const key = process.env.OPENAI_API_KEY?.trim() ?? "";
    const modelName = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const baseNotice = ignoredLink ? "Used the pasted article and ignored the link." : null;

    if (!key) {
      return json(toResponse(draft, { mode: "demo", model: null, sourceKind, notice: baseNotice }));
    }

    try {
      const raw = await draftWithModel({
        title: draft.title,
        sourceText: draft.sourceText,
        claims: draft.claims,
        voice: parseVoice(voice),
        apiKey: key,
        model: modelName,
      });
      const pack = parseModelPack(raw, draft.claims);
      if (!pack) {
        return json(
          toResponse(draft, {
            mode: "demo",
            model: null,
            sourceKind,
            notice: "The model reply could not be used, so this pack uses the local demo rewrite.",
          }),
        );
      }
      const problem = modelPackProblem(pack, draft.sourceText, parseVoice(voice));
      if (problem) {
        return json(toResponse(draft, { mode: "demo", model: null, sourceKind, notice: problem }));
      }

      const steps: Step[] = draft.steps.map((step) =>
        step.id === "draft"
          ? {
              ...step,
              detail: `Drafted with OpenAI (${modelName}). Numbers were checked against the source.`,
            }
          : step,
      );
      return json(
        toResponse(draft, {
          mode: "model",
          model: modelName,
          sourceKind,
          notice: baseNotice,
          pack,
          steps,
        }),
      );
    } catch (error) {
      console.error("Model request failed", error instanceof Error ? error.message : "unknown");
      return json(
        toResponse(draft, {
          mode: "demo",
          model: null,
          sourceKind,
          notice: "The model could not be reached, so this pack uses the local demo rewrite.",
        }),
      );
    }
  } catch (error) {
    if (error instanceof UserInputError) {
      return json({ error: error.message }, 400);
    }
    console.error("Repurpose failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong while reading that source. Try pasting the article text." }, 500);
  }
}
