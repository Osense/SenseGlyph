"use client";
// 계정(목업). 지금은 서버가 없어서 로그인 정보는 이 기기에만 남기고, 비밀번호는 저장하지 않는다.
// 나중에 실제 로그인을 붙이면 signIn/signOut 만 서버 호출로 바꾸고, 프로젝트는
// lib/project-store.ts 의 원격 저장소로 계정에 올린다.
import { create } from "zustand";

export type Provider = "email" | "google" | "kakao" | "guest";
export interface Session {
  name: string;
  email: string;
  provider: Provider;
  since: number;
}
export interface ExportRecord {
  /** 파일 이름(확장자 포함) */
  file: string;
  format: string;
  script: "ko" | "ja";
  projectId: string;
  projectName: string;
  at: number;
}

const SESSION = "senseglyph-session";
const EXPORTS = "senseglyph-exports";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const useAccount = create<{
  /** undefined: 아직 읽기 전, null: 로그인 안 함 */
  session: Session | null | undefined;
  load: () => void;
  signIn: (provider: Provider, email?: string) => void;
  signOut: () => void;
  rename: (name: string) => void;
}>((set, get) => ({
  session: undefined,
  load: () => set({ session: read<Session | null>(SESSION, null) }),
  signIn: (provider, email = "") => {
    const clean = email.trim();
    const name =
      provider === "guest"
        ? "게스트"
        : clean
          ? clean.split("@")[0]
          : provider === "google"
            ? "Google 사용자"
            : provider === "kakao"
              ? "카카오 사용자"
              : "사용자";
    const session: Session = {
      name,
      email:
        clean ||
        (provider === "google"
          ? "user@gmail.com"
          : provider === "kakao"
            ? "user@kakao.com"
            : ""),
      provider,
      since: get().session?.since ?? Date.now(),
    };
    write(SESSION, session);
    set({ session });
  },
  signOut: () => {
    write(SESSION, null);
    set({ session: null });
  },
  rename: (name) => {
    const current = get().session;
    if (!current || !name.trim()) return;
    const session = { ...current, name: name.trim().slice(0, 30) };
    write(SESSION, session);
    set({ session });
  },
}));

/** 내보낸 폰트 기록(이 기기). 최근 50개 */
export function recordExport(record: Omit<ExportRecord, "at">) {
  const list = read<ExportRecord[]>(EXPORTS, []);
  write(EXPORTS, [{ ...record, at: Date.now() }, ...list].slice(0, 50));
}
export function exportHistory(): ExportRecord[] {
  return read<ExportRecord[]>(EXPORTS, []);
}
export function clearExportHistory() {
  write(EXPORTS, null);
}

/** 결제 내역 화면의 예시 데이터(베타는 결제가 없다) */
export const SAMPLE_PAYMENTS = [
  {
    date: "2026-12-01",
    item: "정식 구매 · 한글",
    amount: 19900,
    status: "예시",
  },
  {
    date: "2026-12-01",
    item: "상업용 라이선스",
    amount: 29000,
    status: "예시",
  },
  { date: "2027-01-10", item: "일본어 팩", amount: 9900, status: "예시" },
];
