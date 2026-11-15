// The Cupertino screens, light and dark, wide and narrow: on a real target
// (`nsh test --target web`) they are saved under .nsh/, and the release's
// before/after pairs come from these.
import { open, test } from "nsh/test";

const demo = { storage: { "nshmail.mode": "demo", "nshmail.undoSend": "0" } };
const wide = { platform: "linux", width: 1440, height: 900, locale: "en-US" } as const;
const narrow = { platform: "linux", width: 412, height: 892, locale: "en-US" } as const;

test("Cupertino screens, wide", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const app = await open("./App.tsx", { ...wide, colorScheme: scheme, ...demo });
    // Headless runs draw nothing; a real target saves the pictures.
    const drawn = await app.screenshot().catch(() => null);
    if (!drawn?.length) return;
    await app.waitFor("text:Q4 roadmap draft");
    await app.screenshot(`.nsh/cup-wide-inbox-${scheme}.png`);
    await app.press("text:Q4 roadmap draft");
    await app.waitFor("id:reader >> text:Q4-roadmap.pdf");
    await app.screenshot(`.nsh/cup-wide-reader-${scheme}.png`);
    await app.press("id:reply");
    await app.waitFor("id:compose-subject");
    await app.screenshot(`.nsh/cup-wide-compose-${scheme}.png`);
    await app.press("label:Close");
    await app.waitFor("id:modal", { state: "gone" });
    await app.press("id:open-settings");
    await app.waitFor("text:Keyboard shortcuts");
    await app.screenshot(`.nsh/cup-wide-settings-${scheme}.png`);
    await app.press("id:modal-done");
    await app.waitFor("id:modal", { state: "gone" });
    await app.press("id:rail-notifications");
    await app.waitFor("id:notify-list >> text:CI failed on main");
    await app.press("id:notify-list >> text:CI failed on main");
    await app.waitFor("id:notify-title");
    await app.screenshot(`.nsh/cup-wide-notifications-${scheme}.png`);
    await app.press("text:Search");
    await app.waitFor("text:Search");
  }
}, 180_000);

test("Cupertino screens, narrow", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const app = await open("./App.tsx", { ...narrow, colorScheme: scheme, ...demo });
    const drawn = await app.screenshot().catch(() => null);
    if (!drawn?.length) return;
    await app.waitFor("text:Q4 roadmap draft");
    await app.screenshot(`.nsh/cup-narrow-inbox-${scheme}.png`);
    await app.press("text:Q4 roadmap draft");
    await app.waitFor("id:reader >> text:Q4-roadmap.pdf");
    await app.screenshot(`.nsh/cup-narrow-reader-${scheme}.png`);
    await app.press("id:reply");
    await app.waitFor("id:compose-subject");
    await app.screenshot(`.nsh/cup-narrow-compose-${scheme}.png`);
    await app.press("label:Close");
    await app.waitFor("id:compose-subject", { state: "gone" });
    await app.press("label:Notifications");
    await app.waitFor("id:notify-list >> text:CI failed on main");
    await app.screenshot(`.nsh/cup-narrow-notifications-${scheme}.png`);
    await app.press("label:Mailboxes");
    await app.waitFor("text:All inboxes");
    await app.screenshot(`.nsh/cup-narrow-mailboxes-${scheme}.png`);
    await app.press("label:Settings");
    await app.waitFor("text:Keyboard shortcuts");
    await app.screenshot(`.nsh/cup-narrow-settings-${scheme}.png`);
  }
}, 180_000);
