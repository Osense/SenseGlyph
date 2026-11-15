"use client";
// 공개 안내 페이지(/refund/). 내용은 components/LegalDocument.tsx 와 같은 문서를 쓴다.
import { useEffect } from "react";
import { LegalPageShell } from "../../components/LegalDocument";
import { useLang } from "../../lib/i18n";

export default function RefundPage() {
  useEffect(() => useLang.getState().detect(), []);
  return <LegalPageShell page="refund" />;
}
