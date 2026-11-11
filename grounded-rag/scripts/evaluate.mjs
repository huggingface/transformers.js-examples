/**
 * Reproducible evaluation for the grounded RAG demo.
 *
 * Runs entirely on CPU in Node so it can be compared across machines. It
 * measures retrieval, citation coverage, refusal behavior, and a baseline
 * without retrieved context.
 *
 * Usage:
 *   npm run eval
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AutoModelForCausalLM,
  AutoTokenizer,
  TextStreamer,
  pipeline,
} from "@huggingface/transformers";

import { DOCS } from "../src/knowledge/docs.js";
import { chunkDocuments } from "../src/lib/chunk.js";
import { NLI_MODEL, NliVerifier } from "../src/lib/nli.js";
import {
  buildMessages,
  buildUngroundedMessages,
  REFUSAL,
} from "../src/lib/prompt.js";
import { rankChunks } from "../src/lib/retrieve.js";
import { verifyAnswer } from "../src/lib/verify.js";
import { EVAL_CONFIG, QUESTIONS } from "./eval-questions.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const chunks = chunkDocuments(DOCS);

console.log(`Knowledge base: ${DOCS.length} documents, ${chunks.length} chunks`);

console.log(`Loading ${EVAL_CONFIG.embedModel}...`);
const embedder = await pipeline(
  "feature-extraction",
  EVAL_CONFIG.embedModel,
  { dtype: "q8", device: "cpu" },
);

async function embed(texts) {
  const output = await embedder(texts, { pooling: "mean", normalize: true });
  return output.tolist().map((row) => new Float32Array(row));
}

console.log("Embedding chunks...");
const vectors = [];
for (let start = 0; start < chunks.length; start += 16) {
  const batch = chunks
    .slice(start, start + 16)
    .map((chunk) => chunk.embedText);
  vectors.push(...(await embed(batch)));
  process.stdout.write(
    `\r  ${Math.min(start + 16, chunks.length)} / ${chunks.length}`,
  );
}
process.stdout.write("\n");

console.log(`Loading ${EVAL_CONFIG.generationModel}...`);
const tokenizer = await AutoTokenizer.from_pretrained(
  EVAL_CONFIG.generationModel,
);
const model = await AutoModelForCausalLM.from_pretrained(
  EVAL_CONFIG.generationModel,
  { dtype: "q4", device: "cpu" },
);

console.log(`Loading ${NLI_MODEL}...`);
const nli = new NliVerifier({ device: "cpu" });
await nli.load();

async function generate(messages) {
  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
  });

  let text = "";
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk) => {
      text += chunk;
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: EVAL_CONFIG.maxNewTokens,
    do_sample: false,
    repetition_penalty: 1.05,
    streamer,
  });

  return text.trim();
}

function keywordHit(answer, expectedAny) {
  if (!expectedAny?.length) return null;
  const normalized = answer.toLowerCase();
  return expectedAny.some((keyword) => normalized.includes(keyword));
}

function isRefused(verification) {
  return (
    verification.status === "refused" ||
    verification.status === "refused_after_filter" ||
    verification.answer === REFUSAL
  );
}

function summarizeVerification(verification) {
  return {
    status: verification.status,
    answer: verification.answer,
    supportedCount: verification.supportedCount,
    totalCount: verification.totalCount,
    removedCount: verification.removedCount,
    citations: verification.citations,
    inferredCount: verification.inferredCount,
    correctedCount: verification.correctedCount,
    refused: isRefused(verification),
  };
}

const results = [];
const startedAt = Date.now();

for (const item of QUESTIONS) {
  console.log(`\n[${results.length + 1}/${QUESTIONS.length}] ${item.question}`);

  const queryEmbedding = (await embed([item.question]))[0];
  const sources = rankChunks(queryEmbedding, vectors, chunks, {
    topK: EVAL_CONFIG.topK,
  });
  const topScore = sources[0]?.score ?? 0;
  const hitAt4 = item.expectedDoc
    ? sources.some((source) => source.docId === item.expectedDoc)
    : null;

  const record = {
    id: item.id,
    question: item.question,
    answerable: item.answerable,
    expectedDoc: item.expectedDoc ?? null,
    hitAt4,
    topScore,
    sources: sources.map((source) => ({
      docId: source.docId,
      heading: source.heading,
      score: source.score,
    })),
    grounded: null,
    ungrounded: null,
  };

  if (item.answerable) {
    const groundedStartedAt = Date.now();
    const raw = await generate(buildMessages(item.question, sources));
    const verification = await verifyAnswer(raw, sources, {
      strict: true,
      nli,
    });
    record.grounded = {
      rawAnswer: raw,
      ...summarizeVerification(verification),
      keywordHit: keywordHit(verification.answer, item.expectedAny),
      ms: Date.now() - groundedStartedAt,
    };

    const ungroundedStartedAt = Date.now();
    const baselineRaw = await generate(buildUngroundedMessages(item.question));
    const baselineVerification = await verifyAnswer(
      baselineRaw,
      sources,
      { strict: true, nli },
    );
    record.ungrounded = {
      rawAnswer: baselineRaw,
      ...summarizeVerification(baselineVerification),
      keywordHit: keywordHit(
        baselineVerification.answer,
        item.expectedAny,
      ),
      ms: Date.now() - ungroundedStartedAt,
    };
  } else if (topScore < EVAL_CONFIG.threshold) {
    record.grounded = {
      rawAnswer: null,
      status: "refused",
      answer: REFUSAL,
      supportedCount: 0,
      totalCount: 0,
      removedCount: 0,
      citations: [],
      inferredCount: 0,
      correctedCount: 0,
      refused: true,
      refusedBeforeGeneration: true,
      keywordHit: null,
      ms: 0,
    };
  } else {
    const groundedStartedAt = Date.now();
    const raw = await generate(buildMessages(item.question, sources));
    const verification = await verifyAnswer(raw, sources, {
      strict: true,
      nli,
    });
    record.grounded = {
      rawAnswer: raw,
      ...summarizeVerification(verification),
      refusedBeforeGeneration: false,
      keywordHit: null,
      ms: Date.now() - groundedStartedAt,
    };
  }

  console.log(
    `  top=${topScore.toFixed(3)} hit@4=${hitAt4 ?? "n/a"} grounded=${
      record.grounded.status
    }${record.ungrounded ? ` ungrounded=${record.ungrounded.status}` : ""}`,
  );
  console.log(`  sources: ${record.sources.map((s) => s.docId).join(", ")}`);
  console.log(`  answer: ${record.grounded.answer}`);
  if (record.ungrounded) {
    console.log(`  baseline: ${record.ungrounded.answer}`);
  }

  results.push(record);
}

const answerable = results.filter((result) => result.answerable);
const unanswerable = results.filter((result) => !result.answerable);

function rate(values) {
  if (!values.length) return 0;
  return values.filter(Boolean).length / values.length;
}

const summary = {
  questions: results.length,
  answerable: answerable.length,
  unanswerable: unanswerable.length,
  hitAt4: rate(answerable.map((result) => result.hitAt4)),
  citationRate: rate(
    answerable.map((result) => result.grounded.citations.length > 0),
  ),
  groundedRate: rate(
    answerable.map((result) => result.grounded.status === "grounded"),
  ),
  keywordAccuracy: rate(
    answerable.map((result) => result.grounded.keywordHit),
  ),
  refusalAccuracy: rate(
    unanswerable.map((result) => result.grounded.refused),
  ),
  ungroundedCitationRate: rate(
    answerable.map((result) => result.ungrounded.citations.length > 0),
  ),
  ungroundedGroundedRate: rate(
    answerable.map((result) => result.ungrounded.status === "grounded"),
  ),
  ungroundedKeywordAccuracy: rate(
    answerable.map((result) => result.ungrounded.keywordHit),
  ),
  elapsedMs: Date.now() - startedAt,
  config: { ...EVAL_CONFIG, nliModel: NLI_MODEL },
  generatedAt: new Date().toISOString(),
};

console.log("\n=== Summary ===");
for (const [key, value] of Object.entries(summary)) {
  if (
    typeof value === "number" &&
    key !== "questions" &&
    key !== "answerable" &&
    key !== "unanswerable" &&
    key !== "elapsedMs"
  ) {
    console.log(`${key}: ${(value * 100).toFixed(1)}%`);
  } else if (typeof value !== "object") {
    console.log(`${key}: ${value}`);
  }
}

const resultsFile = resolve(root, "eval-results.json");
writeFileSync(
  resultsFile,
  JSON.stringify({ summary, results }, null, 2) + "\n",
);

const pct = (value) => `${(value * 100).toFixed(0)}%`;
const summaryFile = resolve(root, "src/eval-summary.js");
writeFileSync(
  summaryFile,
  `// Generated by scripts/evaluate.mjs on ${summary.generatedAt}. Do not edit by hand.
export const EVAL_SUMMARY = {
  questions: ${summary.questions},
  answerable: ${summary.answerable},
  unanswerable: ${summary.unanswerable},
  hitAt4: "${pct(summary.hitAt4)}",
  citationRate: "${pct(summary.citationRate)}",
  refusalAccuracy: "${pct(summary.refusalAccuracy)}",
  groundedRate: "${pct(summary.groundedRate)}",
  keywordAccuracy: "${pct(summary.keywordAccuracy)}",
  ungroundedCitationRate: "${pct(summary.ungroundedCitationRate)}",
  ungroundedGroundedRate: "${pct(summary.ungroundedGroundedRate)}",
  ungroundedKeywordAccuracy: "${pct(summary.ungroundedKeywordAccuracy)}",
};
`,
);

console.log(`\nWrote ${resultsFile}`);
console.log(`Wrote ${summaryFile}`);
