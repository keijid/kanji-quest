export type Kun = { stem: string; okuri: string };

export type KanjiEntry = {
  char: string;
  grade: 1 | 2;
  /** 1〜16（小2）。小1の字は 0（問題に出さない） */
  stage: number;
  strokes: number;
  radical: string;
  /** カタカナ */
  on: string[];
  kun: Kun[];
  /** 記法つき（{日光:にっこう}） */
  words: string[];
  questions: {
    /** [ ] の中が対象。答えはその中のふりがな */
    read: string[];
    /** [ ] の中がひらがなの対象。答えはこの字 */
    write: string[];
    /** [ひか(る)] の形。答えはこの字＋おくりがな */
    okuri: string[];
  };
};
