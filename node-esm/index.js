import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline("text-classification");
const result = await classifier("I love Transformers.js!");
console.log(result); // [{ label: 'POSITIVE', score: 0.9997673034667969 }]
