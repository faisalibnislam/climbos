import { describe, expect, it } from "vitest";
import { encodeQr, formatBits, qrSvg } from "../../shared/links/qr";

/**
 * Our own QR encoder. The fixture below was checked by an independent decoder
 * (macOS CoreImage CIDetector) when it was written, along with all 8 masks
 * and versions 1–10; these tests keep that output stable.
 */

const FIXTURE = {
  text: "https://climbos.app/l/Ab12Cd34",
  version: 3,
  mask: 2,
  rows: [
    "11111110000011110010101111111",
    "10000010010101111010101000001",
    "10111010111001010001101011101",
    "10111010111100110101001011101",
    "10111010100100011011001011101",
    "10000010100110000110001000001",
    "11111110101010101010101111111",
    "00000000100010101010100000000",
    "10111110011110001111001111100",
    "00001101111001110001111110001",
    "00111111100011111010110110000",
    "10111100001011010001111101010",
    "00001011011100110111000001100",
    "00101101000010011001011110001",
    "01111011000100000110001111100",
    "01110101001010101010001000010",
    "11110011110110001000100001100",
    "11111100001001110011101110101",
    "10000111010111111110010010100",
    "10110100100001010000001100010",
    "10111110100100110100111110111",
    "00000000100100011011100011111",
    "11111110011110000001101011100",
    "10000010101010101011100010011",
    "10111010110100000110111110101",
    "10111010110010110001010001100",
    "10111010111011010110011111110",
    "10000010011001011000101101010",
    "11111110110110011111011010100",
  ],
};

const rows = (m: boolean[][]) => m.map((r) => r.map((d) => (d ? "1" : "0")).join(""));

describe("QR encoder", () => {
  it("matches the decoder-verified fixture for a short link", () => {
    const qr = encodeQr(FIXTURE.text);
    expect({ version: qr.version, mask: qr.mask }).toEqual({ version: FIXTURE.version, mask: FIXTURE.mask });
    expect(rows(qr.modules)).toEqual(FIXTURE.rows);
  });

  it("has finder patterns, timing lines and readable format bits for every mask", () => {
    for (let mask = 0; mask < 8; mask++) {
      const qr = encodeQr("https://climbos.app/l/xyz789", { mask });
      const m = qr.modules;
      const n = qr.size;
      for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
        for (let i = 0; i < 7; i++) {
          expect(m[y0][x0 + i]).toBe(true);
          expect(m[y0 + 6][x0 + i]).toBe(true);
          expect(m[y0 + 3][x0 + 3]).toBe(true);
        }
      }
      for (let i = 8; i < n - 8; i++) {
        expect(m[6][i]).toBe(i % 2 === 0);
        expect(m[i][6]).toBe(i % 2 === 0);
      }
      // Format bits around the top-left finder (bits 0–5 down column 8).
      const bits = formatBits(mask);
      for (let i = 0; i <= 5; i++) expect(m[i][8]).toBe(((bits >>> i) & 1) === 1);
      expect(m[n - 8][8]).toBe(true); // the dark module
    }
  });

  it("picks the smallest version that fits, up to version 10", () => {
    expect(encodeQr("hi").version).toBe(1);
    expect(encodeQr("x".repeat(100)).version).toBe(6);
    expect(encodeQr("x".repeat(213)).size).toBe(57);
    expect(() => encodeQr("x".repeat(214))).toThrow(/Too long/);
  });

  it("renders an SVG with a quiet zone", () => {
    const svg = qrSvg(FIXTURE.text, { size: 200, title: "Shop <link>" });
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 37 37"/);
    expect(svg).toContain("<title>Shop link</title>");
    expect(svg).toContain('<path d="M4,4h1v1h-1z');
  });
});
