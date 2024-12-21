// Although not strictly necessary, we delegate the tokenization to a worker thread to avoid
// any potential issues with the tokenizer blocking the main thread (especially for large inputs).

import { AutoTokenizer } from "@huggingface/transformers";

// This is a map of all the tokenizer instances that we have loaded.
// model_id -> promise that resolves to tokenizer
const TOKENIZER_MAPPINGS = new Map();

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  const { model_id, text } = event.data;

  // Only load the tokenizer if it hasn't been loaded yet
  let tokenizerPromise = TOKENIZER_MAPPINGS.get(model_id);
  if (!tokenizerPromise) {
    // For visualization purposes, we may need to modify the tokenizer slightly
    tokenizerPromise = AutoTokenizer.from_pretrained(model_id).then(
      (tokenizer) => {
        // NOTE: We just remove the StripDecoder from the llama tokenizer
        const tokenizer_class = (
          tokenizer._tokenizer_config?.tokenizer_class ?? ""
        ).replace(/Fast$/, "");
        switch (tokenizer_class) {
          case "LlamaTokenizer":
          case "Grok1Tokenizer":
            // tokenizer.decoder.decoders.at(-1).constructor.name === 'StripDecoder'
            tokenizer.decoder.decoders.pop();
            break;
          case "T5Tokenizer":
            tokenizer.decoder.addPrefixSpace = false;
            break;
        }
        return tokenizer;
      },
    );

    TOKENIZER_MAPPINGS.set(model_id, tokenizerPromise);
  }

  const tokenizer = await tokenizerPromise;

  // Tokenize the input text
  const token_ids = tokenizer.encode(text);

  // Decode the token IDs back to text
  let decoded = token_ids.map((x) => tokenizer.decode([x]));

  // Minor post-processing for visualization purposes
  let margins = [];
  switch (tokenizer.constructor.name) {
    case "BertTokenizer":
      margins = decoded.map((x, i) => (i === 0 || x.startsWith("##") ? 0 : 8));
      decoded = decoded.map((x) => x.replace("##", ""));
      break;
    case "T5Tokenizer":
      if (decoded.length > 0 && decoded !== " ") {
        decoded[0] = decoded[0].replace(/^ /, "");
      }
      break;
  }

  // Send the output back to the main thread
  self.postMessage({
    token_ids,
    decoded,
    margins,
  });
});
