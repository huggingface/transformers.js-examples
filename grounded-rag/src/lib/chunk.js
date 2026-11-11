const DEFAULT_OPTIONS = {
  maxChars: 900,
  minChars: 120,
};

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g;
const HTML_TAG_RE = /<\/?[A-Za-z][^>]*>/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const TABLE_SEPARATOR_RE = /^\|?[\s:|-]+\|?$/;

/**
 * Split a set of markdown documents into retrieval-sized chunks.
 *
 * @param {Array<{id: string, title: string, source: string, content: string}>} docs
 * @param {{maxChars?: number, minChars?: number}} [options]
 * @returns {Array<{
 *   id: string,
 *   docId: string,
 *   docTitle: string,
 *   source: string,
 *   headings: string[],
 *   heading: string,
 *   text: string,
 *   embedText: string,
 * }>}
 */
export function chunkDocuments(docs, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks = [];

  for (const doc of docs) {
    const sections = splitIntoSections(doc.content);

    for (const section of sections) {
      const blocks = splitIntoBlocks(section.text);
      const pieces = mergeBlocks(blocks, opts);

      for (const piece of pieces) {
        const text = piece.trim();
        if (!text || !/[A-Za-z0-9]/.test(text)) continue;

        const heading = section.headings.at(-1) ?? doc.title;
        const embedText = [
          doc.title,
          ...section.headings,
          "",
          text,
        ]
          .join("\n")
          .trim();

        chunks.push({
          id: `${doc.id}#${chunks.length}`,
          docId: doc.id,
          docTitle: doc.title,
          source: doc.source,
          headings: section.headings,
          heading,
          text,
          embedText,
        });
      }
    }
  }

  return chunks;
}

/**
 * Split markdown into sections, keeping the heading trail for each section.
 */
export function splitIntoSections(markdown) {
  const text = stripFrontmatter(markdown);
  const lines = text.split("\n");

  /** @type {Array<{headings: string[], text: string}>} */
  const sections = [];
  /** @type {Array<{level: number, text: string}>} */
  let headingStack = [];
  let current = [];
  let fence = null;

  const flush = () => {
    const body = current.join("\n").trim();
    if (body) {
      sections.push({
        headings: headingStack.map((heading) => heading.text),
        text: body,
      });
    }
    current = [];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const marker = trimmed.slice(0, 3);
      if (!fence) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      current.push(line);
      continue;
    }

    const heading = !fence ? line.match(HEADING_RE) : null;
    if (heading) {
      flush();
      const level = heading[1].length;
      headingStack = headingStack.filter((item) => item.level < level);
      headingStack.push({ level, text: cleanInline(heading[2]) });
      continue;
    }

    current.push(line);
  }

  flush();
  return sections;
}

/**
 * Split a section into markdown blocks (paragraphs, tables, code fences).
 */
export function splitIntoBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let current = [];
  let fence = null;

  const flush = () => {
    const block = cleanBlock(current.join("\n"));
    if (block && /[A-Za-z0-9]/.test(block)) {
      blocks.push(block);
    }
    current = [];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const marker = trimmed.slice(0, 3);
      if (!fence) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      current.push(line);
      continue;
    }

    if (!fence && line.trim() === "") {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks;
}

/**
 * Merge blocks into chunks no larger than maxChars.
 */
export function mergeBlocks(blocks, { maxChars = 900, minChars = 120 } = {}) {
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const block of blocks) {
    if (block.length > maxChars) {
      flush();
      for (const piece of splitOversizedBlock(block, maxChars)) {
        chunks.push(piece.trim());
      }
      continue;
    }

    if (!current) {
      current = block;
    } else if (current.length + block.length + 2 <= maxChars) {
      current += `\n\n${block}`;
    } else {
      flush();
      current = block;
    }
  }

  flush();

  // Avoid a tiny trailing chunk when it can be folded into the previous one.
  if (chunks.length > 1) {
    const last = chunks.at(-1);
    const previous = chunks.at(-2);
    if (
      last.length < minChars &&
      previous.length + last.length + 2 <= maxChars * 1.15
    ) {
      chunks.splice(-2, 2, `${previous}\n\n${last}`);
    }
  }

  return chunks;
}

function splitOversizedBlock(block, maxChars) {
  const fenceMatch = block.match(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\1?\s*$/);
  if (fenceMatch) {
    const marker = fenceMatch[1];
    const language = fenceMatch[2].trim();
    const body = fenceMatch[3].trimEnd();
    const overhead = marker.length * 2 + language.length + 2;
    const budget = Math.max(200, maxChars - overhead);
    const lines = body.split("\n");
    const pieces = [];
    let current = [];

    const flush = () => {
      if (!current.length) return;
      pieces.push(`${marker}${language}\n${current.join("\n")}\n${marker}`);
      current = [];
    };

    for (const line of lines) {
      if (current.join("\n").length + line.length + 1 > budget && current.length) {
        flush();
      }
      current.push(line);
    }
    flush();

    return pieces;
  }

  if (block.trimStart().startsWith("|")) {
    const rows = block.trim().split("\n");
    const header = rows.slice(0, 2);
    const body = rows.slice(2);
    const pieces = [];
    let current = [];

    const flush = () => {
      if (!current.length) return;
      pieces.push([...header, ...current].join("\n"));
      current = [];
    };

    for (const row of body) {
      if (
        current.join("\n").length + row.length + 1 > maxChars &&
        current.length
      ) {
        flush();
      }
      current.push(row);
    }
    flush();

    return pieces.length ? pieces : [block];
  }

  const sentences = block
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const pieces = [];
  let current = "";

  const flush = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      flush();
      const words = sentence.split(/\s+/);
      let line = "";
      for (const word of words) {
        if (line.length + word.length + 1 > maxChars && line) {
          pieces.push(line.trim());
          line = "";
        }
        line += `${word} `;
      }
      if (line.trim()) pieces.push(line.trim());
      continue;
    }

    if (current.length + sentence.length + 1 > maxChars && current) {
      flush();
    }
    current += `${sentence} `;
  }

  flush();
  return pieces;
}

function stripFrontmatter(markdown) {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(HTML_COMMENT_RE, "");
}

function cleanInline(text) {
  return text
    .replace(LINK_RE, "$1")
    .replace(/`/g, "")
    .replace(HTML_TAG_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBlock(block) {
  const lines = block
    .replace(IMAGE_RE, "$1")
    .replace(HTML_TAG_RE, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^([-*_])\1{2,}$/.test(trimmed)) return false;
      if (
        trimmed.includes("|") &&
        trimmed.includes("-") &&
        TABLE_SEPARATOR_RE.test(trimmed)
      ) {
        return false;
      }
      return true;
    });

  return decodeEntities(lines.join("\n"))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
