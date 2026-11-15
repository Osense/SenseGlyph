// 폰트 이름 중복 확인.
// 1) 이미 있는 폰트 이름(눈누·Google Fonts·시스템 글꼴, data/reserved-font-names.ts)은 쓸 수 없다.
// 2) 다른 사용자가 결제하고 내보낸 이름은 쓸 수 없다 → 나중에 서버 DB에서 확인(registeredOnServer).
//    지금은 DB가 없어서 2)는 항상 '없음'이다.
// 이름은 띄어쓰기 없이 저장·비교하고, 영문은 소문자로만 쓴다.

/** 비교·저장용: 호환 문자 정리 → 소문자 → 공백과 기호 제거 */
export function normalizeFontName(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_.·'"()[\]/,&+:!?’‘“”`]/g, "");
}

/** 입력 정리: 현지 이름은 공백 제거, 영문 이름은 공백 제거 + 소문자 */
export const cleanLocalName = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, "");
export const cleanEnglishName = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

let reserved: Set<string> | null = null;
async function reservedNames() {
  if (!reserved) {
    const { RESERVED_FONT_NAMES } = await import("../data/reserved-font-names");
    reserved = new Set(RESERVED_FONT_NAMES);
  }
  return reserved;
}

export type NameCheck =
  | { available: true }
  | {
      available: false;
      /** 겹친 쪽: 현지 이름 · 영문 이름 */
      field: "local" | "english";
      /** reserved: 이미 있는 폰트, registered: 다른 사용자가 쓰는 이름 */
      reason: "reserved" | "registered";
      name: string;
    };

/** 서버 DB(나중): 결제하고 내보낸 사용자의 폰트 이름. 지금은 항상 false */
async function registeredOnServer(_normalized: string): Promise<boolean> {
  return false;
}

export async function checkFontName(
  local: string,
  english: string,
): Promise<NameCheck> {
  const names = await reservedNames();
  for (const [field, raw] of [
    ["local", local],
    ["english", english],
  ] as const) {
    const key = normalizeFontName(raw);
    if (!key) continue;
    if (names.has(key))
      return { available: false, field, reason: "reserved", name: raw };
    if (await registeredOnServer(key))
      return { available: false, field, reason: "registered", name: raw };
  }
  return { available: true };
}

/** 결제 후 내보낼 때 이름을 서버에 등록(나중). 지금은 아무것도 하지 않는다. */
export async function registerFontName(_local: string, _english: string) {
  return;
}
