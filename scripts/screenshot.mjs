import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:3001/";
const out = process.argv[3] || "/tmp/shot.png";
const width = Number(process.argv[4] || 390);
const height = Number(process.argv[5] || 844);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("saved", out);
