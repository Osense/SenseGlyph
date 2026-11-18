// 프로젝트마다 마지막으로 보던 자리(단계·글자·목록). 메인 화면의 '이어서 하기'가 이 자리로 돌아간다.
// 글씨 자체가 아니라 화면 위치라서 프로젝트 파일이 아닌 이 기기의 localStorage 에 둔다.
const KEY = "senseglyph-resume";

export interface ResumePoint {
  step: number;
  char?: string;
  list?: string;
  at: number;
}

function readAll(): Record<string, ResumePoint> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function getResume(id: string): ResumePoint | undefined {
  const point = readAll()[id];
  return point && Number.isInteger(point.step) ? point : undefined;
}

export function allResume() {
  return readAll();
}

export function setResume(id: string, point: Omit<ResumePoint, "at">) {
  try {
    const all = readAll();
    all[id] = { ...point, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* 저장이 막혀도 작업은 계속 */
  }
}

export function forgetResume(id: string) {
  try {
    const all = readAll();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
