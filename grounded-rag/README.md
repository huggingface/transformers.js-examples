---
title: Grounded RAG
emoji: 🛡️
colorFrom: indigo
colorTo: blue
sdk: static
pinned: false
license: apache-2.0
app_build_command: npm run build
app_file: dist/index.html
short_description: Cited, verified answers over the Transformers.js docs
models:
  - Xenova/all-MiniLM-L6-v2
  - onnx-community/Qwen2.5-0.5B-Instruct-ONNX
  - Xenova/nli-deberta-v3-xsmall
---

# Grounded RAG

A fully in-browser retrieval-augmented generation demo over the
[Transformers.js documentation](https://huggingface.co/docs/transformers.js).
It retrieves relevant documentation chunks, generates an answer with a small
language model, and verifies every sentence against the retrieved sources
before showing it. Unsupported sentences and code blocks are removed. If
nothing survives, the app refuses.

This demo is a contribution toward
[huggingface/transformers.js-examples#79](https://github.com/huggingface/transformers.js-examples/issues/79).

## What it does

1. **Chunk.** The bundled docs are split by heading into retrieval-sized
   chunks. Fenced code blocks and tables stay intact.
2. **Embed.** `Xenova/all-MiniLM-L6-v2` turns each chunk into a normalized
   vector with mean pooling. Vectors are cached in IndexedDB after the first
   run.
3. **Retrieve.** Cosine similarity selects candidates, then maximal marginal
   relevance (MMR) picks a diverse top-k set. The default is four sources. If
   the best cosine score is below 0.30, the app refuses before calling the
   language model.
4. **Generate.** `Qwen2.5-0.5B-Instruct` writes a short answer with source
   citations. WebGPU uses q4f16 when the adapter supports shader-f16, q4
   otherwise. Browsers without WebGPU use q4 on WASM.
5. **Verify.** `Xenova/nli-deberta-v3-xsmall` checks whether each prose
   sentence is entailed by a retrieved chunk. Code blocks must match a source
   verbatim, or almost verbatim, before they are shown.
6. **Filter.** In strict mode, unsupported sentences and code blocks are
   removed. The app refuses if nothing remains. The Checks panel shows the
   original output, per-sentence entailment scores, inferred citations, and
   removed content.

The app also exposes the retrieved sources and the exact prompt it sent to the
model, so the grounding can be inspected instead of trusted.

## Models

| Role | Model | Runtime | Size |
| --- | --- | --- | --- |
| Embeddings | `Xenova/all-MiniLM-L6-v2` | WASM q8 | 23 MB |
| Generation | `onnx-community/Qwen2.5-0.5B-Instruct-ONNX` | WebGPU q4f16 | 483 MB |
| Generation fallback | `onnx-community/Qwen2.5-0.5B-Instruct-ONNX` | WebGPU q4 or WASM q4 | 786 MB |
| Verification | `Xenova/nli-deberta-v3-xsmall` | WASM q8 | 87 MB |

The first load downloads the generation model, the embedding model, and the
verification model. The browser caches them for later visits. The static build
also includes a 26.8 MB ONNX Runtime WASM binary (6.7 MB gzipped).

## Getting started

Clone the examples repository and enter the project directory:

```sh
git clone https://github.com/huggingface/transformers.js-examples.git
cd transformers.js-examples/grounded-rag
```

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open `http://localhost:5173` and ask a question about Transformers.js.

Build the production bundle:

```sh
npm run build
npm run preview
```

## Tests and evaluation

Run the unit tests and linter:

```sh
npm test
npm run lint
```

Run the reproducible evaluation:

```sh
npm run eval
```

The evaluation runs on CPU in Node so results can be compared across machines.
It writes `eval-results.json` and regenerates `src/eval-summary.js`, which the
app imports for the evaluation panel.

### Results

The evaluation set contains 8 answerable questions and 4 unanswerable
questions. The baseline uses the same generation model without retrieval.

| Metric | RAG | No-retrieval baseline |
| --- | --- | --- |
| Retrieval hit@4 | 8/8 (100%) | - |
| Answerable answers with a valid citation | 7/8 (88%) | 4/8 (50%) |
| Answerable answers fully grounded | 7/8 (88%) | 0/8 (0%) |
| Answerable answers with the expected keyword | 7/8 (88%) | 3/8 (38%) |
| Unanswerable questions refused | 4/4 (100%) | - |

The one answerable failure is the 4-bit dtype question. The model listed
`q4`, `q8`, `fp16`, and `fp32`, which does not match the docs. The verifier
rejected the list and the app refused instead of returning a wrong answer.

## Regenerating the knowledge base

The generated knowledge base is committed so the demo runs without a docs
checkout. To rebuild it from a local Transformers.js repository:

```sh
TRANSFORMERS_JS_DOCS=/path/to/transformers.js/packages/transformers/docs \
  npm run build:knowledge
```

This rewrites `src/knowledge/docs.js`. The current snapshot covers 14 pages,
about 131 KiB of Markdown, and produces 212 chunks.

## Limitations

- The generation model is small (0.5B parameters). It can miss details,
  produce inconsistent lists, or write unsupported prose. The verifier removes
  what it can catch, but it can also remove useful sentences.
- The NLI verifier is a small model. Entailment scores are a signal, not a
  proof. Code verification and citation correction also use lexical matching.
- The knowledge base is a snapshot of 14 Transformers.js documentation pages.
  It is not the full documentation site and it is English only.
- The app is not a general-purpose chatbot. Questions outside the bundled docs
  are refused, sometimes before generation.
- The first load is large. The WebGPU path downloads about 593 MB of model
  files; the WASM path downloads about 896 MB. Browser caching makes later
  loads faster.
- The WebGPU path is implemented but was not exercised by the local browser
  smoke test, because headless Chromium has no WebGPU adapter. The WASM path
  was tested end to end.

## License

Apache-2.0. The bundled documentation is from the Transformers.js repository,
which is also Apache-2.0.
