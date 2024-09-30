import { pipeline } from "@huggingface/transformers";

// Create a text-generation pipeline
const generator = await pipeline(
  "text-generation",
  "onnx-community/Llama-3.2-1B-Instruct"
);

// Define the list of messages
const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Tell me a funny joke." },
];

// Generate a response
const output = await generator(messages, { max_new_tokens: 128 });
console.log(output[0].generated_text.at(-1).content);
