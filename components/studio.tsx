"use client";

import { useEffect, useState } from "react";

import { PackView, draftFromPack, type Draft } from "@/components/pack";
import { SAMPLE_ARTICLE, SAMPLE_VOICE } from "@/lib/sample";
import type { RepurposeResponse } from "@/lib/types";

type Status = { mode: "demo" | "model"; model: string | null };

export function Studio() {
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [voice, setVoice] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"idle" | "working" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<RepurposeResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/repurpose")
      .then((response) => response.json())
      .then((data: Status) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus({ mode: "demo", model: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;
  const fallback = Boolean(result && status?.mode === "model" && result.mode === "demo");
  const live = result ? result.mode === "model" : status?.mode === "model";
  const modeClass = fallback ? "warn" : live ? "live" : "demo";
  const chip = fallback
    ? "Demo mode · local fallback"
    : result?.mode === "model" && result.model
      ? `Live model · OpenAI ${result.model}`
      : status?.mode === "model" && status.model
        ? `Live model ready · OpenAI ${status.model}`
        : status
          ? "Demo mode · local rewrite"
          : "Checking mode…";
  const modeDetail = fallback
    ? "The model was not used for this pack. The draft below is the local rewrite."
    : live
      ? "A key is set on the server. A finished pack says OpenAI only when that draft really used it."
      : "No API key in use. Drafts are rewritten on this computer from your text. The same article always makes the same pack.";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setResult(null);
    setDraft(null);
    setPhase("working");
    try {
      const response = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, url, voice }),
      });
      const data = (await response.json()) as RepurposeResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "That did not work. Try the sample article.");
        setPhase("idle");
        return;
      }
      setResult(data);
      setDraft(draftFromPack(data.pack));
      setNotice(data.notice);
      setPhase("ready");
    } catch {
      setError("The app could not reach its own server. Refresh the page and try again.");
      setPhase("idle");
    }
  }

  function loadSample() {
    setSource(SAMPLE_ARTICLE.trim());
    setVoice(SAMPLE_VOICE);
    setUrl("");
    setError(null);
    setResult(null);
    setDraft(null);
    setPhase("idle");
    setNotice("Sample article loaded. Build the pack when you are ready.");
  }

  return (
    <div className="page">
      <a className="skip" href="#studio">
        Skip to the article
      </a>
      <header className="masthead">
        <p className="eyebrow">Portfolio demo</p>
        <h1>Content Repurposing Agent</h1>
        <p className="deck">
          Paste one article. Get a LinkedIn post, an X thread, an Instagram carousel, an email, and a 30-second
          script. Each piece is written for that channel, with the source lines attached.
        </p>
        <div className={`mode ${modeClass}`}>
          <span className="chip">
            <i />
            {chip}
          </span>
          <p>{modeDetail}</p>
        </div>
      </header>

      <main className="layout">
        <form id="studio" className="panel" onSubmit={onSubmit}>
          <h2>01 · Source</h2>
          <div className="field">
            <label htmlFor="source">Article text</label>
            <textarea
              id="source"
              className="source-box"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste the blog post here."
            />
            <p className="count">{words === 0 ? "No article yet" : `${words} words`}</p>
          </div>
          <div className="or">or</div>
          <div className="field">
            <label htmlFor="url">Public link</label>
            <input
              id="url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/blog/post"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="help">If a site blocks the reader, paste the text instead. Private links are refused.</p>
          </div>
          <div className="field">
            <h2>02 · Voice</h2>
            <label htmlFor="voice">Brand voice</label>
            <textarea
              id="voice"
              className="voice-box"
              value={voice}
              onChange={(event) => setVoice(event.target.value)}
              placeholder="Direct and practical. Audience: content marketers. Avoid: synergy, leverage."
            />
            <p className="help">Tone, who it is for, and words to skip. Leave it blank for a direct tone.</p>
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={loadSample}>
              Load sample article
            </button>
            <button type="submit" className="primary" disabled={phase === "working"}>
              {phase === "working" ? "Building…" : "Build the pack"}
            </button>
          </div>
        </form>

        <section className="stage" aria-live="polite">
          {error ? <p className="alert" role="alert">{error}</p> : null}
          {notice && phase !== "working" ? <p className={fallback ? "banner" : "note"}>{notice}</p> : null}
          {phase === "working" ? (
            <p className="reading" role="status">
              <span className="pulse" />
              {url.trim() && !source.trim() ? "Reading the link…" : "Reading the source…"}
            </p>
          ) : null}
          {result && draft ? (
            <PackView result={result} draft={draft} onChange={setDraft} />
          ) : phase === "working" ? null : (
            <div className="empty">
              <h2>Five formats, one source</h2>
              <p className="lede">Load the sample or paste your own article. The pack stays empty until you build it.</p>
              <div className="ghosts">
                <div>
                  <strong>LinkedIn</strong>
                  <span>A hook, the claims, and a question. Not the blog intro pasted in.</span>
                </div>
                <div>
                  <strong>X thread</strong>
                  <span>Numbered posts. One idea each. Short enough to post.</span>
                </div>
                <div>
                  <strong>Instagram carousel</strong>
                  <span>Slide titles and captions. One idea on each slide.</span>
                </div>
                <div>
                  <strong>Email</strong>
                  <span>A subject line, inbox preview text, and a short letter with one ask.</span>
                </div>
                <div>
                  <strong>30-second script</strong>
                  <span>Timed lines you can read aloud. The number comes first when the source has one.</span>
                </div>
              </div>
            </div>
          )}
          <p className="footnote">
            Nothing is posted to a social network. Source notes quote your article so you can see where each idea came from.
          </p>
        </section>
      </main>
    </div>
  );
}
