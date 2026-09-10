import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const OUT = "/tmp";

const mockServices = [{ id: "s1", name: "Κούρεμα", duration_minutes: 30 }];

const mockSlots = ["09:00", "09:30", "10:00", "10:30", "11:30", "13:00", "13:30", "16:00"];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.route("**/api/services", (route) =>
  route.fulfill({ json: { services: mockServices } })
);
await page.route("**/api/slots**", (route) =>
  route.fulfill({ json: { slots: mockSlots } })
);
await page.route("**/api/book", (route) =>
  route.fulfill({
    status: 201,
    json: {
      appointment: {
        id: "a1",
        date: new Date().toISOString().slice(0, 10),
        start_time: "10:00",
        end_time: "10:30",
        services: { name: "Κούρεμα" },
      },
    },
  })
);

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/flow-1-intro.png`, fullPage: true });

await page.getByRole("button", { name: "Κλείσε το επόμενό σου κούρεμα" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/flow-2-calendar.png`, fullPage: true });

await page.getByText("10:00", { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/flow-3-form.png`, fullPage: true });

await page.locator("#firstName").fill("Γιώργος");
await page.locator("#lastName").fill("Παπαδόπουλος");
await page.locator("#mobile").fill("6912345678");
await page.screenshot({ path: `${OUT}/flow-3b-form-filled.png`, fullPage: true });

await page.getByRole("button", { name: "Επιβεβαίωση ραντεβού" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/flow-4-confirmed.png`, fullPage: true });

await browser.close();
console.log("done");
