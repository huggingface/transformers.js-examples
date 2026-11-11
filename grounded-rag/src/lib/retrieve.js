/**
 * Dot product of two unit-length vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function normalizeVector(vector) {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm) || 1;
  const output = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    output[i] = vector[i] / norm;
  }
  return output;
}

/**
 * Rank chunks with maximal marginal relevance.
 *
 * @param {Float32Array} queryEmbedding
 * @param {Float32Array[]} embeddings
 * @param {Array<Record<string, any>>} chunks
 * @param {{topK?: number, candidateK?: number, mmrLambda?: number}} [options]
 */
export function rankChunks(
  queryEmbedding,
  embeddings,
  chunks,
  { topK = 4, candidateK = 24, mmrLambda = 0.72 } = {},
) {
  const scored = [];
  for (let i = 0; i < embeddings.length; i++) {
    scored.push({ index: i, score: cosineSimilarity(queryEmbedding, embeddings[i]) });
  }
  scored.sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, Math.max(candidateK, topK));
  const selected = [];
  const selectedIndices = new Set();

  while (selected.length < topK && candidates.length) {
    let best = null;
    let bestIndex = -1;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (selectedIndices.has(candidate.index)) continue;

      let redundancy = 0;
      if (selected.length) {
        redundancy = Math.max(
          ...selected.map((item) =>
            cosineSimilarity(
              embeddings[candidate.index],
              embeddings[item.index],
            ),
          ),
        );
      }

      const mmr = mmrLambda * candidate.score - (1 - mmrLambda) * redundancy;
      if (!best || mmr > best.mmr) {
        best = { ...candidate, mmr };
        bestIndex = i;
      }
    }

    if (!best) break;
    selected.push(best);
    selectedIndices.add(best.index);
    candidates.splice(bestIndex, 1);
  }

  return selected.map((item) => ({
    ...chunks[item.index],
    index: item.index,
    score: item.score,
  }));
}
