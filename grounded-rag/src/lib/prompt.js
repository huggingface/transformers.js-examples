export const REFUSAL =
  "I don't have enough information in the provided documentation to answer that.";

export const SYSTEM_PROMPT = `You are a documentation assistant for Transformers.js.
Answer the question using ONLY the numbered sources provided by the user.

Rules:
- If the sources do not contain the answer, reply exactly: "${REFUSAL}"
- Cite the source number for every claim, like [1] or [2].
- Do not use outside knowledge. Do not guess.
- Answer in one or two sentences.

Example:
Sources:
[1] Installation
Section: Installation
Run \`npm i @huggingface/transformers\` to install the library.

Question: How do I install the library?
Answer: Run \`npm i @huggingface/transformers\` to install it [1].`;

/**
 * @param {string} question
 * @param {Array<{docTitle: string, heading: string, text: string}>} sources
 */
export function buildMessages(question, sources) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${formatSources(sources)}\n\nQuestion: ${question.trim()}`,
    },
  ];
}

/**
 * @param {Array<{docTitle: string, heading: string, text: string}>} sources
 */
export function formatSources(sources) {
  return sources
    .map((source, index) => {
      const heading = source.heading ? `\nSection: ${source.heading}` : "";
      return `[${index + 1}] ${source.docTitle}${heading}\n${source.text}`;
    })
    .join("\n\n");
}

/**
 * Baseline prompt without retrieved context, used by the evaluation script.
 */
export function buildUngroundedMessages(question) {
  return [
    {
      role: "system",
      content: "You are a helpful assistant. Answer the question concisely.",
    },
    { role: "user", content: question.trim() },
  ];
}
