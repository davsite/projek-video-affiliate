// Voice-over cues: scenes refer to words of the transcript ("the lamp clicks off on *mati*") instead of
// seconds, so a re-recorded voice-over only needs a new transcript — the acting re-times itself.

export type Word = [text: string, start: number, end: number];

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export type Cues = {
  /** film time of a word (n = occurrence, 0-based); throws if the word is missing */
  at: (word: string, n?: number, edge?: "start" | "end") => number;
  end: (word: string, n?: number) => number;
  /** film time of the k-th word overall */
  word: (k: number) => number;
  words: Word[];
  offset: number;
  voEnd: number;
};

export const makeCues = (words: Word[], offset: number): Cues => {
  const find = (w: string, n = 0) => {
    const key = norm(w);
    let k = -1;
    for (let i = 0, seen = 0; i < words.length; i++)
      if (norm(words[i][0]) === key) {
        if (seen === n) { k = i; break; }
        seen++;
      }
    if (k < 0) throw new Error(`cue "${w}" #${n} not in transcript`);
    return words[k];
  };
  return {
    at: (w, n = 0, edge = "start") => offset + find(w, n)[edge === "start" ? 1 : 2],
    end: (w, n = 0) => offset + find(w, n)[2],
    word: (k) => offset + words[k][1],
    words,
    offset,
    voEnd: offset + words[words.length - 1][2],
  };
};
