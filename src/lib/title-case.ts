/**
 * Proper title case for UI text: every word starts with a capital, except short joining words
 * (and, of, the, …) which stay lowercase unless they start the text or a sentence.
 *
 * Only letter case changes — never the length — so it's safe to apply to an input's value while
 * the user types (the caret position stays valid).
 *
 * Left exactly as written:
 *  - fully capitalised words (NAT, QA, SMM) and deliberately mixed-case ones (iPhone, WinOS);
 *  - "technical" chunks: anything with a digit or one of @ / \ : _ . inside (emails, URLs,
 *    task codes like EEDP-3-T5.1, file names, times).
 */

export const TITLE_CASE_SMALL_WORDS = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "so", "yet",
  "as", "at", "by", "in", "of", "on", "per", "to", "up", "via", "vs",
  "with", "from", "into", "onto", "off",
]);

// A chunk (whitespace-separated) containing any of these is technical — left untouched.
const TECHNICAL_CHUNK = /[0-9@/\\:_]|[A-Za-z]\.[A-Za-z]/;
const LETTER_RUN = /[A-Za-z][A-Za-z']*/g;

function caseWord(word: string, forceCapital: boolean): string {
  const letters = word.replace(/'/g, "");
  // Fully capitalised (2+ letters) → keep as written.
  if (letters.length > 1 && letters === letters.toUpperCase()) return word;
  // Capitals after the first letter mean intentional casing (iPhone, WinOS, McDonald) → keep.
  if (/[A-Z]/.test(word.slice(1))) return word;
  const lower = word.toLowerCase();
  if (!forceCapital && TITLE_CASE_SMALL_WORDS.has(lower)) return lower;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * @param startsSentence whether the text begins a sentence (its first word is capitalised even
 *   if it's a small word). Pass false for a fragment that continues earlier text.
 * @param continuesWord the text's first letters finish a word begun in earlier text — e.g. the
 *   "s" of JSX like `Task{n !== 1 ? "s" : ""}`, rendered as its own text node — so they're left
 *   as written instead of being capitalised as a new word ("TaskS").
 */
export function toTitleCaseText(text: string, startsSentence = true, continuesWord = false): string {
  let atSentenceStart = startsSentence;
  let previousChunk = "";
  let skipLeadingLetters = continuesWord && /^[A-Za-z']/.test(text);
  return text.replace(/\S+/g, (chunk) => {
    if (skipLeadingLetters) {
      skipLeadingLetters = false;
      // Keep the word's tail as written, then title-case whatever follows within this chunk.
      const tail = chunk.match(/^[A-Za-z']*/)?.[0] ?? "";
      previousChunk = chunk;
      atSentenceStart = /[.!?:]["')\]]*$/.test(chunk);
      return tail + chunk.slice(tail.length);
    }
    const afterTime = /\d{1,2}(:\d{2})?$/.test(previousChunk);
    previousChunk = chunk;
    // "10:30 am" → "10:30 AM" (only right after a time, so "I am" is untouched).
    if (afterTime && /^(am|pm)$/i.test(chunk)) {
      atSentenceStart = false;
      return chunk.toUpperCase();
    }
    if (TECHNICAL_CHUNK.test(chunk)) {
      atSentenceStart = /[.!?:]["')\]]*$/.test(chunk);
      return chunk;
    }
    let first = true;
    const cased = chunk.replace(LETTER_RUN, (word) => {
      const out = caseWord(word, atSentenceStart && first);
      first = false;
      return out;
    });
    // The next word starts a new sentence after . ! ? or : (ignoring closing quotes/brackets).
    atSentenceStart = /[.!?:]["')\]]*$/.test(chunk);
    return cased;
  });
}
