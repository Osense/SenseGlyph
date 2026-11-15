import { expect, it } from "vitest";
import { LEGAL_DOCS } from "./legal-docs";
import { BUSINESS, hasBusinessInfo, SALES_OPEN } from "./business";

it("keeps the same structure in Korean, Japanese and English", () => {
  for (const docs of Object.values(LEGAL_DOCS)) {
    const counts = (["ko", "ja", "en"] as const).map((lang) =>
      docs[lang].sections.map((section) => section.items.length).join(","),
    );
    expect(new Set(counts).size).toBe(1);
  }
});

it("states the price, trial and withdrawal limits the law asks for", () => {
  const pricing = JSON.stringify(LEGAL_DOCS.pricing.ko);
  expect(pricing).toContain("{price}");
  expect(pricing).toContain("시험 사용");
  const refund = JSON.stringify(LEGAL_DOCS.refund.ko);
  for (const phrase of [
    "7일",
    "환불 불가",
    "{email}",
    "3영업일",
    "미성년자",
    "1372",
  ])
    expect(refund).toContain(phrase);
});

it("never shows invented seller details before registration", () => {
  expect(SALES_OPEN).toBe(false);
  expect(hasBusinessInfo()).toBe(Object.values(BUSINESS).some(Boolean));
});
