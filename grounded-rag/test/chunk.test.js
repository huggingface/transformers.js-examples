import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkDocuments,
  mergeBlocks,
  splitIntoBlocks,
  splitIntoSections,
} from "../src/lib/chunk.js";

const DOC = {
  id: "guide",
  title: "Guide",
  source: "https://example.com/guide.md",
  content: `---
title: ignored
---

# Guide

Intro paragraph.

## Installation

Install with npm.

\`\`\`bash
npm i @huggingface/transformers
\`\`\`

## Options

| Option | Default |
| --- | --- |
| device | wasm |
| dtype | q8 |

Final paragraph.
`,
};

test("splits markdown into sections with a heading trail", () => {
  const sections = splitIntoSections(DOC.content);
  const headings = sections.map((section) => section.headings.join(" > "));

  assert.ok(headings.includes("Guide"));
  assert.ok(headings.includes("Guide > Installation"));
  assert.ok(headings.includes("Guide > Options"));
  assert.ok(!sections.some((section) => section.text.includes("title: ignored")));
});

test("keeps code fences as single blocks", () => {
  const section = splitIntoSections(DOC.content).find((item) =>
    item.headings.includes("Installation"),
  );
  const blocks = splitIntoBlocks(section.text);
  const code = blocks.find((block) => block.includes("```bash"));

  assert.ok(code);
  assert.ok(code.includes("npm i @huggingface/transformers"));
  assert.equal((code.match(/```/g) ?? []).length, 2);
});

test("builds unique chunks with embedding text", () => {
  const chunks = chunkDocuments([DOC]);

  assert.ok(chunks.length > 0);
  assert.equal(new Set(chunks.map((chunk) => chunk.id)).size, chunks.length);

  for (const chunk of chunks) {
    assert.equal(chunk.docId, "guide");
    assert.equal(chunk.docTitle, "Guide");
    assert.equal(chunk.source, DOC.source);
    assert.ok(chunk.text.length > 0);
    assert.ok(chunk.embedText.includes(chunk.text));
    assert.ok(chunk.embedText.startsWith("Guide"));
  }
});

test("splits oversized code blocks and keeps fences balanced", () => {
  const lines = Array.from({ length: 80 }, (_, index) => `const value${index} = ${index};`);
  const block = `\`\`\`js\n${lines.join("\n")}\n\`\`\``;
  const chunks = mergeBlocks([block], { maxChars: 300 });

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.startsWith("```js"));
    assert.ok(chunk.endsWith("```"));
    assert.equal((chunk.match(/```/g) ?? []).length, 2);
  }
});

test("splits oversized tables and repeats the header", () => {
  const rows = Array.from({ length: 40 }, (_, index) => `| model${index} | ${index} |`);
  const table = [
    "| Model | Size |",
    "| --- | --- |",
    ...rows,
  ].join("\n");
  const chunks = mergeBlocks([table], { maxChars: 260 });

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.startsWith("| Model | Size |\n| --- | --- |"));
  }
});

test("folds a tiny trailing chunk into the previous one", () => {
  const chunks = mergeBlocks(["a".repeat(280), "tiny"], {
    maxChars: 300,
    minChars: 50,
  });

  assert.equal(chunks.length, 1);
});
