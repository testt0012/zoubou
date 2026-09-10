import { chromium, devices } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  ...devices["iPhone 13"],
});
await page.route("**/api/services", (route) =>
  route.fulfill({ json: { services: [{ id: "s1", name: "Κούρεμα", duration_minutes: 30 }] } })
);
await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/install-prompt-ios.png", fullPage: false });
await browser.close();
console.log("done");
