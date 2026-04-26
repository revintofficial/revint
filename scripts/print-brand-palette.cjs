function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return {
    hex:
      "#" +
      [R, G, B].map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join(""),
    rgb: [R, G, B],
  };
}

const H = 38;
const S = 78;
const NS = 7;
const TS = 10;

const rows = [
  ["Primary 100", H, S, 88],
  ["Primary 200", H, S, 78],
  ["Primary 300", H, S, 68],
  ["Primary 400", H, S, 58],
  ["Primary 500 (★ brand)", H, S, 50],
  ["Primary 600", H, S, 42],
  ["Primary 700", H, S, 34],
  ["Primary 800", H, S, 26],
  ["Primary 900", H, S, 18],
  ["BG (deepest)", H, NS, 5],
  ["Surface", H, NS, 8],
  ["Card", H, NS, 11],
  ["Hover", H, NS, 14],
  ["Border", H, NS, 18],
  ["Text 1 (primary)", H, TS, 92],
  ["Text 2 (secondary)", H, TS, 70],
  ["Text 3 (muted)", H, TS, 50],
  ["Muted", H, TS, 38],
  ["Success", 152, 48, 50],
  ["Warning", 38, 70, 52],
  ["Error", 4, 62, 54],
];

console.log("Token".padEnd(24) + "HSL".padEnd(22) + "HEX".padEnd(11) + "RGB");
console.log("-".repeat(72));
for (const [name, h, s, l] of rows) {
  const c = hslToHex(h, s, l);
  console.log(
    name.padEnd(24) +
      `hsl(${h} ${s}% ${l}%)`.padEnd(22) +
      c.hex.padEnd(11) +
      `rgb(${c.rgb.join(", ")})`
  );
}
