import { REFUSAL } from "./prompt.js";
import {
  formatCodeBlock,
  normalizeCode,
  parseAnswerSegments,
} from "./segments.js";

const STOPWORDS = new Set(
  `a an the and or but if then else for to of in on at by with from as is are was were be been being
  this that these those it its you your we our they their he she his her not no do does did can could
  should would may might will just also than so such into over under about more most other some any each
  which who whom what when where why how there here have has had using use used via per`
    .split(/\s+/)
    .filter(Boolean),
);

const CITATION_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/**
 * Extract all source numbers cited in a piece of text.
 */
export function extractCitations(text) {
  const citations = [];
  for (const match of text.matchAll(CITATION_RE)) {
    for (const part of match[1].split(",")) {
      const value = Number(part.trim());
      if (Number.isFinite(value)) citations.push(value);
    }
  }
  return [...new Set(citations)];
}

/**
 * Split an answer into sentence-like units, including bullet points.
 */
export function splitSentences(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^(\d+[.)]|[-*])\s+/, ""))
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function isRefusal(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ");
  return (
    normalized.includes("don't have enough information") ||
    normalized.includes("do not have enough information") ||
    normalized.includes("not enough information") ||
    normalized.includes("cannot answer") ||
    normalized.includes("can't answer") ||
    normalized.includes("unable to answer")
  );
}

/**
 * Fraction of a sentence's content words that also appear in a source.
 * Numbers and code-like identifiers are required to match.
 */
export function lexicalSupport(sentence, sourceText) {
  const sentenceTokens = [...new Set(contentTokens(sentence))];
  if (sentenceTokens.length === 0) return 1;

  const sourceTokens = new Set(contentTokens(sourceText));
  let overlap = 0;
  for (const token of sentenceTokens) {
    if (sourceTokens.has(token)) overlap++;
  }

  let score = overlap / sentenceTokens.length;

  const numbers = sentenceTokens.filter((token) => /\d/.test(token));
  if (numbers.some((token) => !sourceTokens.has(token))) {
    score *= 0.5;
  }

  return score;
}

function contentTokens(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]*/g) ?? [])
    .map((token) => token.replace(/[.:/-]+$/, ""))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function addCitation(text, citation) {
  const hasCitation = /\[\d+(?:\s*,\s*\d+)*\]/.test(text);
  return hasCitation
    ? text.replace(CITATION_RE, `[${citation}]`)
    : `${text} [${citation}]`;
}

/**
 * Check every sentence for a valid citation and support in the cited source.
 *
 * When an NLI verifier is supplied, entailment is the primary signal and
 * lexical overlap is a fallback for code-heavy sentences. Otherwise, lexical
 * overlap is used directly.
 *
 * @param {string} rawAnswer
 * @param {Array<{text: string}>} sources
 * @param {{
 *   strict?: boolean,
 *   lexicalThreshold?: number,
 *   nli?: {score: (premise: string, hypothesis: string) => Promise<{entailment: number, contradiction: number, neutral: number}>} | null,
 *   entailmentThreshold?: number,
 * }} [options]
 */
export async function verifyAnswer(
  rawAnswer,
  sources,
  {
    strict = true,
    lexicalThreshold = 0.2,
    nli = null,
    entailmentThreshold = 0.6,
  } = {},
) {
  const answer = (rawAnswer ?? "").trim();

  if (!answer) {
    return emptyResult(answer);
  }

  if (isRefusal(answer)) {
    return {
      answer,
      rawAnswer: answer,
      status: "refused",
      sentences: [
        {
          text: answer,
          displayText: answer,
          status: "refusal",
          citations: [],
          support: 0,
          lexical: 0,
          nli: null,
          sourceIndex: null,
          inferred: false,
          corrected: false,
        },
      ],
      supportedCount: 0,
      totalCount: 1,
      removedCount: 0,
      citations: [],
      invalidCitations: [],
      inferredCount: 0,
      correctedCount: 0,
      usedNli: false,
    };
  }

  const sentences = [];

  for (const segment of parseAnswerSegments(answer)) {
    if (segment.type === "code") {
      const match = findCodeSource(segment.code, sources);
      const supported = Boolean(match);

      sentences.push({
        type: "code",
        text: segment.code,
        displayText: supported ? formatCodeBlock(segment) : segment.raw,
        status: supported ? "supported" : "unsupported_code",
        citations: supported ? [match.index] : [],
        support: supported ? match.score : 0,
        lexical: supported ? match.score : 0,
        nli: null,
        sourceIndex: supported ? match.index : null,
        exactMatch: match?.exact ?? false,
        inferred: false,
        corrected: false,
      });
      continue;
    }

    for (const text of splitSentences(segment.text)) {
      sentences.push(
        await verifyTextSentence(text, sources, {
          lexicalThreshold,
          nli,
          entailmentThreshold,
        }),
      );
    }
  }

  const totalCount = sentences.length;
  const supportedSentences = sentences.filter(
    (sentence) => sentence.status === "supported",
  );
  const supportedCount = supportedSentences.length;

  const invalidCitations = [
    ...new Set(
      sentences.flatMap((sentence) =>
        sentence.status === "invalid_citation" ? sentence.citations : [],
      ),
    ),
  ];
  const citations = [
    ...new Set(
      supportedSentences.flatMap((sentence) => sentence.citations),
    ),
  ];

  let status =
    supportedCount === totalCount
      ? "grounded"
      : supportedCount > 0
        ? "partially_grounded"
        : "unsupported";

  let finalAnswer = answer;
  let removedCount = 0;

  if (strict) {
    const kept = supportedSentences;

    removedCount = totalCount - kept.length;

    if (kept.length === 0) {
      finalAnswer = REFUSAL;
      status = "refused_after_filter";
    } else {
      finalAnswer = joinUnits(kept);
      status = kept.length === totalCount ? "grounded" : "partially_grounded";
    }
  } else {
    finalAnswer = joinUnits(sentences);
  }

  return {
    answer: finalAnswer,
    rawAnswer: answer,
    status,
    sentences,
    supportedCount,
    totalCount,
    removedCount,
    citations,
    invalidCitations,
    inferredCount: sentences.filter((sentence) => sentence.inferred).length,
    correctedCount: sentences.filter((sentence) => sentence.corrected).length,
    usedNli: Boolean(nli),
  };
}

/**
 * Check a single prose sentence against the retrieved sources.
 */
async function verifyTextSentence(
  text,
  sources,
  { lexicalThreshold, nli, entailmentThreshold },
) {
  const citations = extractCitations(text);
  const valid = citations.filter(
    (citation) => citation >= 1 && citation <= sources.length,
  );
  const invalid = citations.filter(
    (citation) => citation < 1 || citation > sources.length,
  );

  const lexicalScores = sources.map((source, index) => ({
    index,
    lexical: lexicalSupport(text, source.text),
  }));
  lexicalScores.sort((a, b) => b.lexical - a.lexical);

  let candidateIndices;
  if (valid.length) {
    candidateIndices = [
      ...new Set([
        ...valid.map((citation) => citation - 1),
        ...lexicalScores.slice(0, 2).map((item) => item.index),
      ]),
    ];
  } else if (nli) {
    candidateIndices = lexicalScores.slice(0, 3).map((item) => item.index);
  } else {
    candidateIndices = sources.map((_, index) => index);
  }

  let best = null;
  for (const index of candidateIndices) {
    const lexical =
      lexicalScores.find((item) => item.index === index)?.lexical ?? 0;
    let nliScores = null;

    if (nli) {
      try {
        nliScores = await nli.score(sources[index].text, text);
      } catch {
        nliScores = null;
      }
    }

    const candidate = {
      index,
      lexical,
      nli: nliScores,
      entailment: nliScores?.entailment ?? null,
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (nli) {
      const bestEntailment = best.entailment ?? -1;
      const candidateEntailment = candidate.entailment ?? -1;
      if (
        candidateEntailment > bestEntailment ||
        (candidateEntailment === bestEntailment &&
          candidate.lexical > best.lexical)
      ) {
        best = candidate;
      }
    } else if (candidate.lexical > best.lexical) {
      best = candidate;
    }
  }

  if (!best) {
    best = { index: 0, lexical: 0, nli: null, entailment: null };
  }

  let supported;
  if (best.entailment !== null) {
    const codeLike = /[`{}();=]/.test(text);
    supported =
      best.entailment >= entailmentThreshold ||
      (codeLike && best.lexical >= 0.5 && best.entailment >= 0.2);
  } else {
    supported = best.lexical >= lexicalThreshold;
  }

  const citation = best.index + 1;
  const citedSource = valid.includes(citation);
  const inferred = citations.length === 0 && supported;
  const corrected = citations.length > 0 && !citedSource && supported;

  const status = supported
    ? "supported"
    : citations.length === 0
      ? "no_citation"
      : invalid.length
        ? "invalid_citation"
        : "weak_support";

  return {
    type: "text",
    text,
    displayText: supported && !citedSource ? addCitation(text, citation) : text,
    status,
    citations: supported && !citedSource ? [citation] : citations,
    support: best.entailment ?? best.lexical,
    lexical: best.lexical,
    nli: best.nli,
    sourceIndex: citation,
    inferred,
    corrected,
  };
}

/**
 * Find the source containing a code block. Exact matches are preferred;
 * near-verbatim matches are accepted when almost all code tokens appear in a
 * single source (for example `npm install` vs `npm i`).
 */
function findCodeSource(code, sources) {
  const needle = normalizeCode(code);
  if (needle.length < 8) return null;

  for (let index = 0; index < sources.length; index++) {
    if (normalizeCode(sources[index].text).includes(needle)) {
      return { index: index + 1, exact: true, score: 1 };
    }
  }

  const tokens = code.match(/[a-z0-9][a-z0-9_.:/-]*/gi) ?? [];
  if (tokens.length < 2) return null;

  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < sources.length; index++) {
    const score = lexicalSupport(code, sources[index].text);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestScore >= 0.65
    ? { index: bestIndex + 1, exact: false, score: bestScore }
    : null;
}

/**
 * Join verified units, keeping code blocks on their own paragraphs.
 */
function joinUnits(units) {
  const parts = [];
  let prose = [];

  const flushProse = () => {
    if (!prose.length) return;
    parts.push(prose.join(" "));
    prose = [];
  };

  for (const unit of units) {
    if (unit.type === "code") {
      flushProse();
      parts.push(unit.displayText);
    } else {
      prose.push(unit.displayText);
    }
  }
  flushProse();

  return parts.join("\n\n");
}

function emptyResult(answer) {
  return {
    answer: REFUSAL,
    rawAnswer: answer,
    status: "empty",
    sentences: [],
    supportedCount: 0,
    totalCount: 0,
    removedCount: 0,
    citations: [],
    invalidCitations: [],
    inferredCount: 0,
    correctedCount: 0,
    usedNli: false,
  };
}

export const GROUNDEDNESS_LABELS = {
  grounded: "Grounded",
  partially_grounded: "Partially grounded",
  unsupported: "Unsupported",
  refused: "Refused",
  refused_after_filter: "Refused after verification",
  empty: "No answer",
};
