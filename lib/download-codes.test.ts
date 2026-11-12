import { expect, it } from "vitest";
import { isDownloadCode } from "./download-codes";

it("accepts the temporary download codes regardless of spacing and case", () => {
  for (const code of [
    "오쎈스",
    "HHSS",
    "hhss",
    " OSNS ",
    "osns",
    "내포초",
    "한울초",
    "황금포도",
    "권감독",
    "허감독",
    "한울 초",
  ])
    expect(isDownloadCode(code)).toBe(true);
  for (const code of ["", "osnsstudio", "한울사랑", "명천사랑", "1234"])
    expect(isDownloadCode(code)).toBe(false);
  // Decomposed (NFD) Hangul from some keyboards still matches.
  expect(isDownloadCode("한울초".normalize("NFD"))).toBe(true);
});
