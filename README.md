# Content Repurposing Agent

Marketers often spend hours turning one blog post into a LinkedIn post, an X thread, an Instagram carousel, an email, and a short video script. The drafts sound the same because someone pasted the blog intro into every box.

This is a small web app that shows that job on one screen. You paste an article (or a public link) and a short brand-voice note. The app returns five formats that are written for each channel, plus the exact source lines each draft used.

It is a portfolio demo. It does not post anything to a social network.

## Run it

You need [Node.js](https://nodejs.org/) 20 or newer. In a terminal:

```bash
node -v
```

If that prints `v20` or higher, install and start the app from this folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To check the rewrite logic without the browser:

```bash
npm test
```

## Try the demo

1. Click **Load sample article**. The sample is a short study about teams losing hours after a blog post goes live.
2. Read the brand-voice box. It sets the tone, the audience, and words to skip.
3. Click **Build the pack**.
4. Watch the steps: read the source, pull claims, apply the voice, draft five formats, attach source notes.
5. Open each format. Edit any line. Use **Copy** when you want the text.

The sample’s claims include real figures from the article, such as 4.5 hours, 2.1 times, 38 percent, 42 characters, and 2.4 times. If a number is not in the claim list, it should not be in the pack.

## What to say in a walkthrough

You can record the screen and talk through it like this:

1. “The problem is not a missing blog post. It is the half day spent turning one post into native copy for every channel.”
2. “Here is the source. These sentences are the only facts the pack is allowed to use.”
3. Click **Build the pack**. “The steps are the job: read, pull claims, match the voice, draft, then show the source line under each draft.”
4. LinkedIn: “This one teaches. It opens with the finding, then lists the claims, then asks a question.”
5. X: “This one teases. Each numbered post is a single idea, and it stays inside the character limit.”
6. Instagram: “This one is a carousel outline. Big title on the slide, one sentence underneath.”
7. Email: “Subject, the preview line next to it in the inbox, and a short letter with one ask.”
8. Video: “About 30 seconds when you read the quoted lines aloud. It opens on a number from the article.”
9. Point at **From the source**. “These quotes are copied from the article. I can see which ideas were used, and I can edit the draft before I copy it.”
10. Point at the mode chip. “This run is demo mode. It rewrites locally. It is not a live chat model unless a key is added later.”

## Demo mode and a real model later

**Demo mode is the default.** The app rewrites the article with a fixed set of rules on your computer. No account, no API key, and no request to an AI provider. The same article and the same voice note always produce the same pack. The screen says **Demo mode · local rewrite**. It does not pretend to be connected to ChatGPT.

A real model is optional. Copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

Restart `npm run dev`. The chip changes to say an OpenAI model is ready. If the model replies with a number that is not in your article, or it uses a word you said to avoid, the app throws that reply away and shows the local rewrite instead. The screen tells you when that happens.

`.env.local` is listed in `.gitignore`. Do not commit a key, and do not paste a key into the README or the chat.

## What each format is for

| Format | Job in the pack |
| --- | --- |
| LinkedIn | Teach. A hook, the claims, a question. |
| X thread | Tease. Numbered posts, one idea each. |
| Instagram | List. Slide title plus caption. |
| Email | Invite. Subject, preheader, one proof, one ask. |
| Video | Hook. A 30-second script with timestamps. |

## Project layout

- `app/page.tsx` is the screen.
- `app/api/repurpose/route.ts` reads a link, if you gave one, and builds the pack.
- `lib/repurpose.ts` and `lib/formats.ts` are the local rewrite.
- `lib/sample.ts` is the built-in article.

Links are checked before they are opened. Local and private addresses are refused. If a page does not return article text, paste the text instead.
