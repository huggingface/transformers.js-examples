/**
 * Evaluation set for the grounded RAG demo.
 *
 * Answerable questions must be answered from the bundled Transformers.js
 * documentation. Unanswerable questions are used to check that retrieval
 * refuses instead of guessing.
 */
export const QUESTIONS = [
  {
    id: "webgpu",
    question: "How do I run a model on WebGPU?",
    answerable: true,
    expectedDoc: "guides/webgpu",
    expectedAny: ["webgpu"],
  },
  {
    id: "dtype-4bit",
    question: "Which dtypes are available for 4-bit quantization?",
    answerable: true,
    expectedDoc: "guides/dtypes",
    expectedAny: ["q4", "bnb4", "q4f16"],
  },
  {
    id: "remote-loading",
    question: "How do I disable remote model loading?",
    answerable: true,
    expectedDoc: "tutorials/node",
    expectedAny: ["local", "remote", "env.local"],
  },
  {
    id: "streaming",
    question: "How do I stream generated text?",
    answerable: true,
    expectedDoc: "pipelines",
    expectedAny: ["streamer", "stream"],
  },
  {
    id: "pipeline-api",
    question: "What is the pipeline API?",
    answerable: true,
    expectedDoc: "pipelines",
    expectedAny: ["pipeline"],
  },
  {
    id: "react",
    question: "How do I use Transformers.js in a React app?",
    answerable: true,
    expectedDoc: "tutorials/react",
    expectedAny: ["react"],
  },
  {
    id: "npm-install",
    question: "How do I install Transformers.js with npm?",
    answerable: true,
    expectedDoc: "installation",
    expectedAny: ["npm"],
  },
  {
    id: "onnx-conversion",
    question: "How do I convert a PyTorch model to ONNX?",
    answerable: true,
    expectedDoc: "custom_usage",
    expectedAny: ["onnx", "optimum"],
  },
  {
    id: "capital-france",
    question: "What is the capital of France?",
    answerable: false,
  },
  {
    id: "fine-tuning",
    question: "How do I fine-tune a model?",
    answerable: false,
  },
  {
    id: "world-cup",
    question: "Who won the 2022 World Cup?",
    answerable: false,
  },
  {
    id: "weather",
    question: "What is the weather in Paris?",
    answerable: false,
  },
];

export const EVAL_CONFIG = {
  topK: 4,
  threshold: 0.3,
  maxNewTokens: 160,
  embedModel: "Xenova/all-MiniLM-L6-v2",
  generationModel: "onnx-community/Qwen2.5-0.5B-Instruct-ONNX",
};
