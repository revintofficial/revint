// scripts/website-audit-eval/debug-signals.ts — print location/hotel/language signals for one snapshot.
//   npx tsx scripts/website-audit-eval/debug-signals.ts <snapshot.html>
import { readFileSync } from "node:fs";
import { detectHotelOperator, detectLanguageCount, detectLocations, visibleText } from "@/lib/site-signals";

const raw = readFileSync(process.argv[2], "utf8");
const url = /^<!-- (\S+) -->/.exec(raw)?.[1] ?? "https://example.test/";
const html = raw.replace(/^<!-- \S+ -->\n/, "");
const text = visibleText(html);
console.log("text length", text.length, "postcodes:", text.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/g));
console.log(JSON.stringify(detectLocations([{ url, html, kind: "home" }]), null, 1));
console.log(JSON.stringify(detectHotelOperator([{ url, html, kind: "home" }])));
console.log(JSON.stringify(detectLanguageCount(url, html)));
