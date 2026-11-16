// The composed sentence of a slot answer may be edited by hand, but only by
// adding words (connectives, "chiếc", "thì"...) so it reads less mechanically:
// every word of the composed sentence must still be there, in the same order.
// That keeps the sentence saying what the cells say, which is the reason the
// server composes it at all. Case and punctuation are free to change.
// No imports, so `node --test` loads it without the Next.js resolver.

export const MAX_EDITED_LENGTH = 1000;

const words = (text: string) => text.toLocaleLowerCase("vi").normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? [];

/** Why `edited` is not an allowed edit of `composed`, or null when it is. */
export function editProblem(composed: string, edited: string): string | null {
  const text = edited.trim();
  if (!text) return "Câu không được để trống.";
  if (text.length > MAX_EDITED_LENGTH) return `Câu dài quá ${MAX_EDITED_LENGTH} ký tự.`;
  const have = words(text);
  let at = 0;
  for (const word of words(composed)) {
    while (at < have.length && have[at] !== word) at += 1;
    if (at === have.length) {
      return `Chỉ được thêm từ nối, không xóa, đổi hay đảo chữ của câu ghép: thiếu "${word}" (hoặc sai thứ tự).`;
    }
    at += 1;
  }
  return null;
}

/** The sentence to store: the edit when there is one that differs, else the composed sentence. */
export function sentenceToStore(composed: string, edited: string | null | undefined): string {
  const text = edited?.trim();
  return text && text !== composed ? text : composed;
}
