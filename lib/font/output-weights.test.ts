import opentype from "opentype.js";
import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { checksum, sfntTable } from "./cmap";
import { convertFont } from "./export-formats";
import { completeFixture } from "./fixtures";
import { generateFont } from "./generate";
import { nameOutputFont } from "./output-names";
import { defaultPreparation } from "./types";

const names = { korean: "내손글씨", english: "MyHand" };

it("names Light, Regular and Bold as one family with matching flags", () => {
  const result = generateFont({
    project: completeFixture(),
    preparation: defaultPreparation("나의 손글씨"),
  });
  const expected = {
    Light: {
      weight: 300,
      bold: false,
      sub: "Regular",
      family: "OSNS MyHand Light",
    },
    Regular: {
      weight: 400,
      bold: false,
      sub: "Regular",
      family: "OSNS MyHand",
    },
    Bold: { weight: 700, bold: true, sub: "Bold", family: "OSNS MyHand" },
  } as const;
  for (const style of ["Light", "Regular", "Bold"] as const) {
    const buffer = nameOutputFont(result.ttf, names, style);
    expect(checksum(new Uint8Array(buffer))).toBe(0xb1b0afba);
    const font = opentype.parse(buffer);
    expect(font.names.fontFamily.en).toBe(expected[style].family);
    expect(font.names.fontSubfamily.en).toBe(expected[style].sub);
    expect(font.names.postScriptName.en).toBe("OSNSMyHand-" + style);
    if (style !== "Regular") {
      expect((font.names as any).preferredFamily.en).toBe("OSNS MyHand");
      expect((font.names as any).preferredSubfamily.en).toBe(style);
    }
    const os2 = new DataView(sfntTable(buffer, "OS/2").buffer);
    expect(os2.getUint16(4)).toBe(expected[style].weight);
    expect(!!(os2.getUint16(62) & 0x20)).toBe(expected[style].bold);
    const head = new DataView(sfntTable(buffer, "head").buffer);
    expect(!!(head.getUint16(44) & 1)).toBe(expected[style].bold);
  }
}, 60_000);

it("packs three weights into one zip", async () => {
  const result = generateFont({
    project: completeFixture(),
    preparation: defaultPreparation("나의 손글씨"),
  });
  const pair = { ttf: result.ttf, otf: result.otf };
  const zip = await convertFont({
    ...pair,
    format: "weights",
    filename: "OSNS 내손글씨",
    names,
    light: pair,
    bold: pair,
  });
  const files = Object.keys(unzipSync(new Uint8Array(zip))).sort();
  expect(files).toEqual([
    "LICENSE.txt",
    ...["Bold", "Light", "Regular"].flatMap((s) => [
      `OSNS 내손글씨-${s}.otf`,
      `OSNS 내손글씨-${s}.ttf`,
    ]),
  ]);
}, 60_000);
