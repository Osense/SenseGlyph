// 임시 다운로드 코드. 정적 사이트라 코드는 내려받은 스크립트에 그대로 들어 있습니다.
// 결제 대신 쓰는 시험용 관문이며, 이후 이 파일과 확인 창을 지우면 됩니다.
const CODES = [
  "오쎈스",
  "HHSS",
  "OSNS",
  "내포초",
  "한울초",
  "황금포도",
  "권감독",
  "허감독",
];
const normalize = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, "").toLowerCase();
const accepted = new Set(CODES.map(normalize));

export function isDownloadCode(value: string) {
  return accepted.has(normalize(value));
}

const KEY = "senseglyph-download-code";
/** 같은 탭에서 한 번 확인하면 다시 묻지 않습니다(새로고침·새 탭에서는 다시 확인). */
export function rememberedDownloadCode() {
  try {
    return sessionStorage.getItem(KEY) === "ok";
  } catch {
    return false;
  }
}
export function rememberDownloadCode() {
  try {
    sessionStorage.setItem(KEY, "ok");
  } catch {}
}
