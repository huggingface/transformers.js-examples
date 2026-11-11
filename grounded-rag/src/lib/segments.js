const FENCE_RE = /```([^\n`]*)\n?([\s\S]*?)```/g;

/**
 * Split an answer into prose and fenced code segments.
 *
 * Unclosed fences are treated as code so truncated generations cannot smuggle
 * unverified text past the checker.
 */
export function parseAnswerSegments(answer) {
  const text = String(answer ?? "");
  const segments = [];
  let lastIndex = 0;
  let match;

  FENCE_RE.lastIndex = 0;
  while ((match = FENCE_RE.exec(text))) {
    if (match.index > lastIndex) {
      const prose = text.slice(lastIndex, match.index);
      if (prose.trim()) segments.push({ type: "text", text: prose });
    }

    segments.push({
      type: "code",
      lang: match[1].trim(),
      code: match[2].replace(/\n$/, ""),
      raw: match[0],
    });
    lastIndex = FENCE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    const open = rest.match(/^```([^\n`]*)\n?([\s\S]*)$/);

    if (open) {
      segments.push({
        type: "code",
        lang: open[1].trim(),
        code: open[2],
        raw: rest,
        unclosed: true,
      });
    } else if (rest.trim()) {
      segments.push({ type: "text", text: rest });
    }
  }

  return segments;
}

/**
 * Normalize code so indentation and quoting differences do not matter when
 * checking whether a block appears in a retrieved chunk.
 */
export function normalizeCode(code) {
  return String(code)
    .toLowerCase()
    .replace(/[`"']/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * Rebuild a fenced code block for display.
 */
export function formatCodeBlock({ lang, code }) {
  return `\`\`\`${lang ? lang : ""}\n${code.trimEnd()}\n\`\`\``;
}
