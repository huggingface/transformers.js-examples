import {
  AutoModelForCausalLM,
  AutoTokenizer,
  InterruptableStoppingCriteria,
  TextStreamer,
  env,
  pipeline,
} from "@huggingface/transformers";

import { DOCS } from "./knowledge/docs.js";
import { chunkDocuments } from "./lib/chunk.js";
import { loadEmbeddings, saveEmbeddings } from "./lib/cache.js";
import { NLI_MODEL, NliVerifier } from "./lib/nli.js";
import { buildMessages, REFUSAL, SYSTEM_PROMPT } from "./lib/prompt.js";
import { rankChunks } from "./lib/retrieve.js";
import { verifyAnswer } from "./lib/verify.js";

const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const GENERATION_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct-ONNX";
const KB_VERSION = 2;

let hasWebGPU = false;
let webgpuAdapter = null;

const stoppingCriteria = new InterruptableStoppingCriteria();

let embedder = null;
let tokenizer = null;
let generator = null;
let verifier = null;
let verifierFailed = false;
let generationDevice = "wasm";
let generationDtype = "q8";

let chunks = [];
let embeddings = null;
let cacheHit = false;
let initialized = false;
let busy = false;

const progressCallback = (event) => {
  self.postMessage(event);
};

function post(status, data) {
  self.postMessage({ status, data });
}

/**
 * Pick WebGPU only when the browser can actually provide an adapter.
 *
 * transformers.js chains WebGPU and WASM session creation through one shared
 * promise. A failed WebGPU load rejects that chain and makes every later
 * attempt fail with the first error, so a cheap adapter check before loading
 * is the difference between a working WASM fallback and a dead demo.
 */
async function detectWebGPU() {
  if (typeof navigator === "undefined" || !navigator.gpu) return false;

  try {
    webgpuAdapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.warn("Unable to request a WebGPU adapter.", error);
    webgpuAdapter = null;
  }

  if (!webgpuAdapter) return false;

  const webgpuEnv = env.backends.onnx?.webgpu;
  if (webgpuEnv) webgpuEnv.adapter = webgpuAdapter;

  return true;
}

async function init() {
  if (initialized) {
    post("ready", readyPayload());
    return;
  }

  hasWebGPU = await detectWebGPU();
  generationDevice = hasWebGPU ? "webgpu" : "wasm";
  generationDtype = hasWebGPU
    ? webgpuAdapter.features.has("shader-f16")
      ? "q4f16"
      : "q4"
    : "q4";

  post("loading", "Loading the embedding model...");

  embedder = await pipeline("feature-extraction", EMBED_MODEL, {
    dtype: "q8",
    device: "wasm",
    progress_callback: progressCallback,
  });

  post("loading", "Preparing the knowledge base...");
  chunks = chunkDocuments(DOCS);

  const cacheKey = `${EMBED_MODEL}|${KB_VERSION}|${chunks.length}`;
  embeddings = await loadEmbeddings(cacheKey);

  if (embeddings) {
    cacheHit = true;
    post("index", {
      stage: "cached",
      current: chunks.length,
      total: chunks.length,
    });
  } else {
    cacheHit = false;
    embeddings = await embedChunks();
    await saveEmbeddings(cacheKey, embeddings);
  }

  initialized = true;
  post("ready", readyPayload());
}

function readyPayload() {
  return {
    chunks: chunks.length,
    cacheHit,
    embedModel: EMBED_MODEL,
    generationModel: GENERATION_MODEL,
    generationDevice,
    generationDtype,
    verificationModel: NLI_MODEL,
    webgpu: hasWebGPU,
  };
}

async function embedChunks() {
  const batchSize = 16;
  const vectors = [];

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks
      .slice(start, start + batchSize)
      .map((chunk) => chunk.embedText);

    const output = await embedder(batch, {
      pooling: "mean",
      normalize: true,
    });

    for (const row of output.tolist()) {
      vectors.push(new Float32Array(row));
    }

    post("index", {
      stage: "embedding",
      current: Math.min(start + batchSize, chunks.length),
      total: chunks.length,
    });
  }

  return vectors;
}

async function embedQuery(question) {
  const output = await embedder(question, {
    pooling: "mean",
    normalize: true,
  });
  return new Float32Array(output.data);
}

async function loadGenerator() {
  if (generator && tokenizer) return;

  post("loading", "Loading the generation model...");

  let attempts;

  if (hasWebGPU) {
    const supportsFp16 = webgpuAdapter?.features?.has("shader-f16") ?? false;
    generationDevice = "webgpu";
    generationDtype = supportsFp16 ? "q4f16" : "q4";
    attempts = [{ device: "webgpu", dtype: generationDtype }];
  } else {
    generationDevice = "wasm";
    generationDtype = "q4";
    attempts = [{ device: "wasm", dtype: "q4" }];
  }

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const [loadedTokenizer, loadedModel] = await Promise.all([
        AutoTokenizer.from_pretrained(GENERATION_MODEL, {
          progress_callback: progressCallback,
        }),
        AutoModelForCausalLM.from_pretrained(GENERATION_MODEL, {
          dtype: attempt.dtype,
          device: attempt.device,
          progress_callback: progressCallback,
        }),
      ]);

      tokenizer = loadedTokenizer;
      generator = loadedModel;
      generationDevice = attempt.device;
      generationDtype = attempt.dtype;
      post("ready", readyPayload());
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `Failed to load ${GENERATION_MODEL} on ${attempt.device}/${attempt.dtype}`,
        error,
      );
    }
  }

  throw new Error(
    `Unable to load the generation model: ${lastError?.message ?? "unknown error"}`,
  );
}

async function loadVerifier() {
  if (verifier || verifierFailed) return verifier;

  try {
    const instance = new NliVerifier({ device: "wasm" });
    await instance.load(progressCallback);
    verifier = instance;
    return verifier;
  } catch (error) {
    console.warn("Unable to load the NLI verifier; using lexical checks only.", error);
    verifierFailed = true;
    return null;
  }
}

async function ask({ id, question, topK, threshold, strict }) {
  if (busy) {
    post("error", { id, message: "Another request is already running." });
    return;
  }

  if (!initialized) {
    post("error", { id, message: "The knowledge base is not ready yet." });
    return;
  }

  busy = true;
  const startedAt = performance.now();

  try {
    const retrievalStartedAt = performance.now();
    const queryEmbedding = await embedQuery(question);
    const sources = rankChunks(queryEmbedding, embeddings, chunks, { topK });
    const retrievalMs = performance.now() - retrievalStartedAt;
    const topScore = sources[0]?.score ?? 0;
    const insufficientContext = topScore < threshold;

    post("retrieval", {
      id,
      sources,
      topScore,
      threshold,
      insufficientContext,
      retrievalMs,
    });

    if (insufficientContext) {
      const verification = await verifyAnswer(REFUSAL, sources, { strict });
      post("complete", {
        id,
        answer: verification.answer,
        rawAnswer: verification.rawAnswer,
        verification,
        sources,
        timings: {
          retrievalMs,
          generationMs: 0,
          verificationMs: 0,
          totalMs: performance.now() - startedAt,
          ttftMs: null,
          tokens: 0,
          tokensPerSecond: 0,
        },
        refusedBeforeGeneration: true,
        cancelled: false,
        prompt: null,
        generationDevice,
        generationDtype,
      });
      return;
    }

    await loadGenerator();

    const messages = buildMessages(question, sources);
    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });

    const generationStartedAt = performance.now();
    let firstTokenAt = null;
    let tokenCount = 0;
    let streamed = "";

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => {
        if (firstTokenAt === null) firstTokenAt = performance.now();
        streamed += text;
        post("update", { id, output: text });
      },
      token_callback_function: () => {
        tokenCount++;
      },
    });

    stoppingCriteria.reset();
    await generator.generate({
      ...inputs,
      max_new_tokens: 160,
      do_sample: false,
      repetition_penalty: 1.05,
      streamer,
      stopping_criteria: stoppingCriteria,
    });

    const generationMs = performance.now() - generationStartedAt;
    const rawAnswer = streamed.trim();

    post("verifying", {
      id,
      message: verifier
        ? "Checking each sentence against the cited sources..."
        : "Loading the verification model (first run only)...",
    });

    const verificationStartedAt = performance.now();
    const nli = await loadVerifier();

    post("verifying", {
      id,
      message: "Checking each sentence against the cited sources...",
    });

    const verification = await verifyAnswer(rawAnswer, sources, {
      strict,
      nli,
    });
    const verificationMs = performance.now() - verificationStartedAt;

    post("complete", {
      id,
      answer: verification.answer,
      rawAnswer,
      verification,
      sources,
      timings: {
        retrievalMs,
        generationMs,
        verificationMs,
        totalMs: performance.now() - startedAt,
        ttftMs: firstTokenAt === null ? null : firstTokenAt - generationStartedAt,
        tokens: tokenCount,
        tokensPerSecond:
          generationMs > 0 ? tokenCount / (generationMs / 1000) : 0,
      },
      refusedBeforeGeneration: false,
      cancelled: false,
      prompt: {
        system: SYSTEM_PROMPT,
        user: messages[1].content,
      },
      generationDevice,
      generationDtype,
      verificationModel: nli ? NLI_MODEL : null,
    });
  } catch (error) {
    console.error(error);
    post("error", { id, message: error?.message ?? String(error) });
  } finally {
    busy = false;
  }
}

self.addEventListener("message", (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "init":
      init().catch((error) => {
        console.error(error);
        post("error", { message: error?.message ?? String(error) });
      });
      break;

    case "ask":
      ask(data);
      break;

    case "cancel":
      stoppingCriteria.interrupt();
      break;

    case "reset":
      stoppingCriteria.reset();
      break;
  }
});
