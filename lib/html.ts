function decode(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const number = Number(code);
      return number > 0 && number < 65536 ? String.fromCharCode(number) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const number = Number.parseInt(code, 16);
      return number > 0 && number < 65536 ? String.fromCharCode(number) : "";
    });
}

function stripTags(value: string): string {
  return decode(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function htmlToArticle(html: string): { title: string; text: string } {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|footer|aside|form)[\s\S]*?<\/\1>/gi, " ");

  const titleMatch =
    withoutNoise.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? withoutNoise.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";

  const blocks: string[] = [];
  const blockPattern = /<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of withoutNoise.matchAll(blockPattern)) {
    const block = stripTags(match[2] ?? "");
    if (block.length > 1) blocks.push(block);
  }

  let text = blocks.join("\n\n");
  if (text.split(/\s+/).length < 40) {
    text = stripTags(withoutNoise);
  }
  if (title && !text.toLowerCase().startsWith(title.toLowerCase())) {
    text = `${title}\n\n${text}`;
  }
  return { title: title || "Untitled page", text: text.trim() };
}
