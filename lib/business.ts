// 판매자(사업자) 정보와 법적 고지의 공통 값.
// 전자상거래법 제10조·시행령 제11조의4: 상호·대표자·주소·전화·이메일·사업자등록번호·
// 통신판매업 신고번호(신고기관 포함)·이용약관·호스팅서비스 제공자를 첫 화면이나 바로 연결된 화면에 보여야 한다.
// 사업자 등록과 통신판매업 신고를 마치면 아래 빈칸만 채우면 된다(지어낸 값을 넣지 말 것).

export interface BusinessInfo {
  /** 상호 */
  name: string;
  /** 대표자 성명 */
  owner: string;
  /** 영업소 주소 */
  address: string;
  /** 전화번호 */
  phone: string;
  /** 전자우편 */
  email: string;
  /** 사업자등록번호 (예: 000-00-00000) */
  registration: string;
  /** 통신판매업 신고번호, 신고기관 포함 (예: 제2027-충남홍성-0000호) */
  mailOrder: string;
  /** 개인정보 보호책임자 (이름 또는 직책) */
  privacyOfficer: string;
}

export const BUSINESS: BusinessInfo = {
  name: "",
  owner: "",
  address: "",
  phone: "",
  email: "",
  registration: "",
  mailOrder: "",
  privacyOfficer: "",
};

/** 웹 버전을 제공하는 호스팅서비스 사업자 */
export const HOSTING = "GitHub, Inc. (GitHub Pages)";

/** 유료 판매를 시작했는지. 사업자 정보·PG 연결을 마친 뒤 true 로 바꾼다. */
export const SALES_OPEN = false;

/** 이용약관·환불 규정·가격 안내의 시행일 */
export const LEGAL_EFFECTIVE = "2026-11-15";

/** 환불·오류 신고 등 모든 문의를 받는 이메일 */
export const CONTACT_EMAIL = "osns.studio@gmail.com";
/** 운영자 웹사이트 */
export const CONTACT_URL = "https://wsns.studio/";

/** 사업자 정보가 채워졌는지 */
export const hasBusinessInfo = () =>
  Boolean(BUSINESS.name && BUSINESS.owner && BUSINESS.registration);

/** 법적 고지 페이지 주소(정적 사이트 경로) */
export const LEGAL_PAGES = {
  pricing: "pricing/",
  terms: "terms/",
  refund: "refund/",
  privacy: "privacy/",
} as const;
export type LegalPage = keyof typeof LEGAL_PAGES;
