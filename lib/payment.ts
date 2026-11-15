"use client";
// 결제(목업). 나중에 PG(토스페이먼츠·포트원 등)를 붙일 자리.
// - requestPayment: 지금은 '준비 중'만 돌려준다. PG 연결 시 결제창 호출 → 서버 승인 확인으로 바꾼다.
// - 테스트 코드: 베타 동안 결제 없이 내려받는 코드. 클라이언트에 들어 있으므로 실제 판매 전에는
//   서버 확인(쿠폰 DB)으로 바꿔야 한다.
// 결제(또는 코드)를 통과하면 이 창(세션) 동안은 다시 묻지 않는다.

export type PayMethod = "card" | "kakaopay" | "naverpay" | "tosspay";
export interface Order {
  item: string;
  amount: number;
  fontName: string;
  format: string;
}

const UNLOCK = "senseglyph-unlocked";
const TEST_CODES = ["권오현"];

export const PRICE = 19900;

export function isUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK) === "1";
  } catch {
    return false;
  }
}
function unlock() {
  try {
    sessionStorage.setItem(UNLOCK, "1");
  } catch {}
}

/** 코드 확인: 앞뒤 공백·가운데 공백은 무시 */
export function redeemCode(code: string) {
  const ok = TEST_CODES.includes(code.replace(/\s+/g, "").normalize("NFC"));
  if (ok) unlock();
  return ok;
}

/** PG 결제 요청(목업): 잠시 처리하는 척한 뒤 '준비 중'을 돌려준다. */
export async function requestPayment(
  _order: Order,
  _method: PayMethod,
): Promise<{ status: "paid" } | { status: "unavailable" }> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return { status: "unavailable" };
}
