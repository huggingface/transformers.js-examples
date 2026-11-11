import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCitations,
  isRefusal,
  lexicalSupport,
  splitSentences,
  verifyAnswer,
} from "../src/lib/verify.js";
import { normalizeNliText } from "../src/lib/nli.js";

const SOURCES = [
  { text: "Set device to webgpu when loading a model." },
  { text: "The capital of France is Paris." },
];

test("extracts and deduplicates citations", () => {
  assert.deepEqual(extractCitations("A [1], B [2, 1], C [4]."), [1, 2, 4]);
  assert.deepEqual(extractCitations("No citations here."), []);
});

test("splits sentences and bullets", () => {
  assert.deepEqual(splitSentences("One. Two! Three?\n- Four."), [
    "One.",
    "Two!",
    "Three?",
    "Four.",
  ]);
});

test("detects refusals", () => {
  assert.equal(isRefusal("I don't have enough information to answer."), true);
  assert.equal(isRefusal("The docs do not contain that."), false);
});

test("lexical support rewards matching content words", () => {
  const high = lexicalSupport(
    "Set device to webgpu when loading a model.",
    "Set device to webgpu when loading a model.",
  );
  const low = lexicalSupport(
    "The capital of France is Paris.",
    "Set device to webgpu when loading a model.",
  );

  assert.ok(high > 0.9);
  assert.ok(low < 0.2);
});

test("marks a cited and supported sentence as grounded", async () => {
  const result = await verifyAnswer(
    "Set device to webgpu when loading a model [1].",
    SOURCES,
    { strict: true },
  );

  assert.equal(result.status, "grounded");
  assert.equal(result.supportedCount, 1);
  assert.equal(result.sentences[0].status, "supported");
  assert.equal(result.answer, "Set device to webgpu when loading a model [1].");
});

test("removes uncited sentences in strict mode", async () => {
  const result = await verifyAnswer(
    "Set device to webgpu when loading a model. Bananas are yellow.",
    SOURCES,
    { strict: true },
  );

  assert.equal(result.status, "partially_grounded");
  assert.equal(result.removedCount, 1);
  assert.equal(result.answer, "Set device to webgpu when loading a model. [1]");
});

test("refuses when strict mode removes everything", async () => {
  const result = await verifyAnswer("Bananas are yellow.", SOURCES, {
    strict: true,
  });

  assert.equal(result.status, "refused_after_filter");
  assert.match(result.answer, /don't have enough information/);
});

test("keeps unsupported sentences when strict mode is off", async () => {
  const result = await verifyAnswer(
    "Set device to webgpu when loading a model [1]. Bananas are yellow [1].",
    SOURCES,
    { strict: false },
  );

  assert.equal(result.status, "partially_grounded");
  assert.equal(result.removedCount, 0);
  assert.equal(result.sentences[1].status, "weak_support");
});

test("flags invalid citations on unsupported sentences", async () => {
  const result = await verifyAnswer("Bananas are yellow [9].", SOURCES, {
    strict: false,
  });

  assert.equal(result.sentences[0].status, "invalid_citation");
  assert.deepEqual(result.invalidCitations, [9]);
});

test("corrects a wrong citation when the sentence is supported elsewhere", async () => {
  const result = await verifyAnswer(
    "The capital of France is Paris [1].",
    SOURCES,
    { strict: false },
  );

  assert.equal(result.sentences[0].status, "supported");
  assert.equal(result.sentences[0].corrected, true);
  assert.equal(result.sentences[0].sourceIndex, 2);
});

test("treats an explicit refusal as a refusal", async () => {
  const result = await verifyAnswer(
    "I don't have enough information in the provided documentation to answer that.",
    SOURCES,
    { strict: true },
  );

  assert.equal(result.status, "refused");
  assert.equal(result.sentences[0].status, "refusal");
});

test("handles an empty answer", async () => {
  const result = await verifyAnswer("", SOURCES, { strict: true });

  assert.equal(result.status, "empty");
  assert.match(result.answer, /don't have enough information/);
});

test("infers a citation when NLI supports an uncited sentence", async () => {
  const nli = {
    async score(premise, hypothesis) {
      if (
        premise.includes("device") &&
        hypothesis.includes("Set device")
      ) {
        return { entailment: 0.94, contradiction: 0.01, neutral: 0.05 };
      }
      return { entailment: 0.01, contradiction: 0.1, neutral: 0.89 };
    },
  };

  const result = await verifyAnswer(
    "Set device to webgpu when loading a model. The capital of France is Paris.",
    SOURCES,
    { strict: true, nli },
  );

  assert.equal(result.status, "partially_grounded");
  assert.equal(result.inferredCount, 1);
  assert.equal(result.sentences[0].inferred, true);
  assert.equal(result.sentences[0].sourceIndex, 1);
  assert.equal(result.answer, "Set device to webgpu when loading a model. [1]");
});

test("corrects a citation that points at the wrong source", async () => {
  const nli = {
    async score(premise, hypothesis) {
      if (premise.includes("device") && hypothesis.includes("Set device")) {
        return { entailment: 0.91, contradiction: 0.02, neutral: 0.07 };
      }
      return { entailment: 0.02, contradiction: 0.1, neutral: 0.88 };
    },
  };

  const result = await verifyAnswer(
    "Set device to webgpu when loading a model [2].",
    SOURCES,
    { strict: true, nli },
  );

  assert.equal(result.correctedCount, 1);
  assert.equal(result.sentences[0].corrected, true);
  assert.equal(result.sentences[0].sourceIndex, 1);
  assert.equal(result.answer, "Set device to webgpu when loading a model [1].");
});

test("rejects a sentence that contradicts every source", async () => {
  const nli = {
    async score() {
      return { entailment: 0.01, contradiction: 0.98, neutral: 0.01 };
    },
  };

  const result = await verifyAnswer(
    "Transformers.js was created by Google [1].",
    SOURCES,
    { strict: true, nli },
  );

  assert.equal(result.status, "refused_after_filter");
  assert.equal(result.removedCount, 1);
});

test("normalizes markdown before NLI scoring", () => {
  assert.equal(
    normalizeNliText('Set `device` to "webgpu".'),
    "Set device to webgpu.",
  );
});

test("keeps a code block that appears verbatim in a source", async () => {
  const result = await verifyAnswer(
    "Run the command npm i @huggingface/transformers [1].\n```bash\nnpm i @huggingface/transformers\n```",
    [
      {
        text: "Run:\n```bash\nnpm i @huggingface/transformers\n```",
      },
    ],
    { strict: true },
  );

  assert.equal(result.status, "grounded");
  assert.equal(result.sentences[0].type, "text");
  assert.equal(result.sentences[1].type, "code");
  assert.equal(result.sentences[1].status, "supported");
  assert.equal(result.sentences[1].exactMatch, true);
  assert.deepEqual(result.sentences[1].citations, [1]);
  assert.match(result.answer, /```bash/);
  assert.equal((result.answer.match(/\[1\]/g) ?? []).length, 1);
});

test("drops a code block that does not appear in any source", async () => {
  const result = await verifyAnswer(
    "```bash\nnpm i @huggingface/transformers\n```",
    [{ text: "Set device to webgpu when loading a model." }],
    { strict: true },
  );

  assert.equal(result.status, "refused_after_filter");
  assert.equal(result.removedCount, 1);
});

test("treats an unclosed code fence as code and closes it", async () => {
  const result = await verifyAnswer(
    "```bash\nnpm i @huggingface/transformers",
    [
      {
        text: "Run:\n```bash\nnpm i @huggingface/transformers\n```",
      },
    ],
    { strict: true },
  );

  assert.equal(result.status, "grounded");
  assert.equal(result.sentences[0].type, "code");
  assert.match(result.answer, /```$/);
});

test("does not inject citations inside code", async () => {
  const result = await verifyAnswer(
    "```js\nconst x = 1;\n```",
    [{ text: "Example:\n```js\nconst x = 1;\n```" }],
    { strict: true },
  );

  assert.equal(result.status, "grounded");
  assert.deepEqual(result.citations, [1]);
  assert.ok(!result.answer.includes("[1]"));
});

test("rejects a high-overlap sentence when entailment is below the threshold", async () => {
  const nli = {
    async score() {
      return { entailment: 0.5, contradiction: 0.1, neutral: 0.4 };
    },
  };

  const result = await verifyAnswer(
    "Set device to webgpu when loading a model [1].",
    SOURCES,
    { strict: true, nli },
  );

  assert.equal(result.status, "refused_after_filter");
});

test("strips numeric list markers before splitting", () => {
  assert.deepEqual(
    splitSentences("1. Install the library.\n2. Import it."),
    ["Install the library.", "Import it."],
  );
});

test("keeps near-verbatim code when most tokens match a source", async () => {
  const result = await verifyAnswer(
    "Run the command npm i @huggingface/transformers [1].\n```bash\nnpm install @huggingface/transformers\n```",
    [
      {
        text: "Run:\n```bash\nnpm i @huggingface/transformers\n```",
      },
    ],
    { strict: true },
  );

  assert.equal(result.status, "grounded");
  assert.equal(result.sentences[1].type, "code");
  assert.equal(result.sentences[1].status, "supported");
  assert.equal(result.sentences[1].exactMatch, false);
});
