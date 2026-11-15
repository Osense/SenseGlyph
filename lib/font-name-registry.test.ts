import { expect, it } from "vitest";
import {
  checkFontName,
  cleanEnglishName,
  cleanLocalName,
  normalizeFontName,
} from "./font-name-registry";

it("cleans names: no spaces, English lower case", () => {
  expect(cleanLocalName("나의 손 글씨")).toBe("나의손글씨");
  expect(cleanEnglishName("My Hand Writing")).toBe("myhandwriting");
  expect(normalizeFontName("Noto Sans-KR")).toBe("notosanskr");
});

it("rejects existing font names, even with spaces or capitals", async () => {
  for (const [local, english] of [
    ["프리텐다드", "x1"],
    ["나눔 손글씨", "x2"],
    ["맑은 고딕", "x3"],
    ["새이름", "Pretendard"],
    ["새이름", "ROBOTO"],
    ["G마켓 산스", "x4"],
  ]) {
    const result = await checkFontName(local, english);
    expect(result.available, local + "/" + english).toBe(false);
  }
});

it("accepts a new name (no server registry yet)", async () => {
  expect(await checkFontName("오현이의손글씨", "ohyeonihand")).toEqual({
    available: true,
  });
});
