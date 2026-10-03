import { lookup } from "node:dns/promises";

import { htmlToArticle } from "./html";
import { isBlockedIp, parsePublicUrl, UserInputError } from "./safe-url";
import { wordCount } from "./text";

async function assertPublicHost(hostname: string): Promise<void> {
  if (isBlockedIp(hostname)) {
    throw new UserInputError("That link points at a private network. Paste the article text instead.");
  }
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UserInputError("That link could not be found. Paste the article text instead.");
  }
  if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
    throw new UserInputError("That link points at a private network. Paste the article text instead.");
  }
}

export async function fetchArticle(input: string): Promise<{ title: string; text: string }> {
  let current = parsePublicUrl(input);

  for (let hop = 0; hop < 3; hop += 1) {
    await assertPublicHost(current.hostname);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: "text/html,text/plain;q=0.9",
          "User-Agent": "ContentRepurposingAgent/1.0 (portfolio demo; single page read)",
        },
      });
    } catch (error) {
      if (error instanceof UserInputError) throw error;
      throw new UserInputError("That link could not be read. Paste the article text instead.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UserInputError("That link redirected without a destination. Paste the article text instead.");
      }
      current = parsePublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new UserInputError(`That link returned an error (${response.status}). Paste the article text instead.`);
    }

    const type = response.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      throw new UserInputError("That link is not an article page. Paste the text instead.");
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 1_500_000) {
      throw new UserInputError("That page is too large. Paste the article text instead.");
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const article = /text\/plain/i.test(type) ? { title: "", text: html } : htmlToArticle(html);
    if (wordCount(article.text) < 40) {
      throw new UserInputError("That page did not include enough article text. Paste the text instead.");
    }
    return {
      title: article.title || "Untitled page",
      text: article.title && !article.text.startsWith(article.title) ? `${article.title}\n\n${article.text}` : article.text,
    };
  }

  throw new UserInputError("That link redirected too many times. Paste the article text instead.");
}
