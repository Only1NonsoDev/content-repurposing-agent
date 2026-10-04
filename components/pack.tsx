"use client";

import { useState } from "react";

import type { Claim, Pack, RepurposeResponse } from "@/lib/types";

export type Draft = {
  linkedin: string;
  posts: string[];
  slides: { title: string; caption: string }[];
  subject: string;
  preheader: string;
  body: string;
  video: string;
};

export function draftFromPack(pack: Pack): Draft {
  return {
    linkedin: pack.linkedin.text,
    posts: [...pack.thread.posts],
    slides: pack.instagram.slides.map((slide) => ({ ...slide })),
    subject: pack.email.subject,
    preheader: pack.email.preheader,
    body: pack.email.body,
    video: pack.video.script,
  };
}

function packText(title: string, draft: Draft): string {
  return [
    title,
    "",
    "LINKEDIN",
    draft.linkedin.trim(),
    "",
    "X THREAD",
    draft.posts.map((post) => post.trim()).join("\n\n"),
    "",
    "INSTAGRAM CAROUSEL",
    draft.slides.map((slide, index) => `${index + 1}. ${slide.title.trim()}\n${slide.caption.trim()}`).join("\n\n"),
    "",
    "EMAIL",
    `Subject: ${draft.subject.trim()}`,
    `Preheader: ${draft.preheader.trim()}`,
    "",
    draft.body.trim(),
    "",
    "30-SECOND VIDEO",
    draft.video.trim(),
  ].join("\n");
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone("copied");
        } catch {
          setDone("failed");
        }
        window.setTimeout(() => setDone("idle"), 1600);
      }}
    >
      {done === "copied" ? "Copied" : done === "failed" ? "Copy blocked" : label}
    </button>
  );
}

function Edited({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="edited">Edited</span>;
}

function SourceNotes({ ids, claims }: { ids: string[]; claims: Claim[] }) {
  const used = ids
    .map((id) => claims.find((claim) => claim.id === id))
    .filter((claim): claim is Claim => Boolean(claim));
  if (used.length === 0) return null;
  return (
    <div className="notes">
      <p>From the source</p>
      <ul>
        {used.map((claim) => (
          <li key={claim.id}>
            <a className="id" href={`#claim-${claim.id}`}>
              {claim.id.toUpperCase()}
            </a>
            <q>{claim.text}</q>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PackView({
  result,
  draft,
  onChange,
}: {
  result: RepurposeResponse;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const original = draftFromPack(result.pack);

  function patch(partial: Partial<Draft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="pack" style={{ ["--steps" as string]: result.steps.length }}>
      <ol className="steps">
        {result.steps.map((step, index) => (
          <li key={step.id} style={{ ["--i" as string]: index }}>
            <span className="tick" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </span>
          </li>
        ))}
      </ol>

      <div className="stage-head">
        <div>
          <h2>{result.title}</h2>
          <p>
            {result.wordCount} words · {result.sourceKind === "url" ? "read from the link" : "from the pasted article"}
          </p>
        </div>
        <CopyButton text={packText(result.title, draft)} label="Copy full pack" />
      </div>

      <nav className="jump" aria-label="Formats">
        <a href="#linkedin">LinkedIn</a>
        <a href="#thread">X thread</a>
        <a href="#instagram">Instagram</a>
        <a href="#email">Email</a>
        <a href="#video">Video</a>
      </nav>

      <section className="claim-board">
        <h3>Claims kept from the source</h3>
        <p className="lede">These lines are quoted from the article. The drafts below are rewrites of them, not new facts.</p>
        <ol className="claims">
          {result.claims.map((claim) => (
            <li key={claim.id} id={`claim-${claim.id}`}>
              <span className="id">{claim.id.toUpperCase()}</span>
              <p>
                {claim.text}
                {claim.hasNumber ? <span className="num">includes a number</span> : null}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="formats">
      <article className="card" id="linkedin" data-platform="linkedin">
        <div className="card-top">
          <p className="kicker">LinkedIn</p>
          <span>
            <Edited on={draft.linkedin !== original.linkedin} />{" "}
            <CopyButton text={draft.linkedin} />
          </span>
        </div>
        <h3>Post</h3>
        <p className="job">Hook, then the claims, then a question. Hashtags are words from the source.</p>
        <textarea
          className="editor"
          aria-label="LinkedIn post"
          value={draft.linkedin}
          onChange={(event) => patch({ linkedin: event.target.value })}
        />
        <SourceNotes ids={result.pack.linkedin.claimIds} claims={result.claims} />
      </article>

      <article className="card" id="thread" data-platform="x">
        <div className="card-top">
          <p className="kicker">X / Twitter</p>
          <span>
            <Edited on={draft.posts.join("\n") !== original.posts.join("\n")} />{" "}
            <CopyButton text={draft.posts.join("\n\n")} label="Copy thread" />
          </span>
        </div>
        <h3>Thread</h3>
        <p className="job">Numbered posts. One idea each. Stay under 280 characters.</p>
        <div className="posts">
          {draft.posts.map((post, index) => (
            <div className="post" key={`post-${index}`}>
              <label htmlFor={`post-${index}`}>Post {index + 1}</label>
              <textarea
                id={`post-${index}`}
                className="editor short"
                value={post}
                onChange={(event) => {
                  const posts = [...draft.posts];
                  posts[index] = event.target.value;
                  patch({ posts });
                }}
              />
              <p className={post.length > 280 ? "meta over" : "meta"}>{post.length}/280</p>
            </div>
          ))}
        </div>
        <SourceNotes ids={result.pack.thread.claimIds} claims={result.claims} />
      </article>

      <article className="card" id="instagram" data-platform="instagram">
        <div className="card-top">
          <p className="kicker">Instagram</p>
          <span>
            <Edited
              on={draft.slides.map((slide) => `${slide.title}|${slide.caption}`).join("\n") !==
                original.slides.map((slide) => `${slide.title}|${slide.caption}`).join("\n")}
            />{" "}
            <CopyButton
              text={draft.slides.map((slide, index) => `${index + 1}. ${slide.title}\n${slide.caption}`).join("\n\n")}
              label="Copy carousel"
            />
          </span>
        </div>
        <h3>Carousel outline</h3>
        <p className="job">A title for the slide. A caption for the words. One idea at a time.</p>
        <div className="slides">
          {draft.slides.map((slide, index) => (
            <div className="slide" key={`slide-${index}`}>
              <div className="slide-top">
                <label htmlFor={`slide-title-${index}`}>Slide {index + 1} title</label>
              </div>
              <input
                id={`slide-title-${index}`}
                className="slide-title"
                value={slide.title}
                onChange={(event) => {
                  const slides = draft.slides.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, title: event.target.value } : item,
                  );
                  patch({ slides });
                }}
              />
              <label htmlFor={`slide-caption-${index}`}>Caption</label>
              <textarea
                id={`slide-caption-${index}`}
                className="editor short"
                value={slide.caption}
                onChange={(event) => {
                  const slides = draft.slides.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, caption: event.target.value } : item,
                  );
                  patch({ slides });
                }}
              />
            </div>
          ))}
        </div>
        <SourceNotes ids={result.pack.instagram.claimIds} claims={result.claims} />
      </article>

      <article className="card" id="email" data-platform="email">
        <div className="card-top">
          <p className="kicker">Email</p>
          <span>
            <Edited
              on={
                draft.subject !== original.subject ||
                draft.preheader !== original.preheader ||
                draft.body !== original.body
              }
            />{" "}
            <CopyButton
              text={`Subject: ${draft.subject}\nPreheader: ${draft.preheader}\n\n${draft.body}`}
              label="Copy email"
            />
          </span>
        </div>
        <h3>Blurb</h3>
        <p className="job">Subject, the inbox preview line, and a short letter with one ask.</p>
        <div className="email-fields">
          <div>
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              className="inline"
              value={draft.subject}
              onChange={(event) => patch({ subject: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="preheader">Preheader</label>
            <input
              id="preheader"
              className="inline"
              value={draft.preheader}
              onChange={(event) => patch({ preheader: event.target.value })}
            />
            <p className="help">The preview text that sits next to the subject in an inbox.</p>
          </div>
        </div>
        <label htmlFor="email-body">Body</label>
        <textarea
          id="email-body"
          className="editor"
          value={draft.body}
          onChange={(event) => patch({ body: event.target.value })}
        />
        <SourceNotes ids={result.pack.email.claimIds} claims={result.claims} />
      </article>

      <article className="card" id="video" data-platform="video">
        <div className="card-top">
          <p className="kicker">Video</p>
          <span>
            <Edited on={draft.video !== original.video} /> <CopyButton text={draft.video} label="Copy script" />
          </span>
        </div>
        <h3>30-second script</h3>
        <p className="job">Read the quoted lines aloud. If you run long, cut the proof line first.</p>
        <textarea
          className="editor"
          aria-label="30-second video script"
          value={draft.video}
          onChange={(event) => patch({ video: event.target.value })}
        />
        <SourceNotes ids={result.pack.video.claimIds} claims={result.claims} />
      </article>
      </div>
    </div>
  );
}
