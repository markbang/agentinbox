// The Cupertino screens, light and dark, wide and narrow: on a real target
// (`nsh test --target web`) they are saved under .nsh/, and the release's
// before/after pairs come from these.
import { open, test } from "nsh/test";

const demo = { storage: { "nshmail.mode": "demo", "nshmail.undoSend": "0" } };
const wide = { platform: "linux", width: 1440, height: 900, locale: "en-US" } as const;
const narrow = { platform: "linux", width: 412, height: 892, locale: "en-US" } as const;

async function draw(options: Record<string, unknown>) {
  const app = await open("./App.tsx", options);
  // Headless runs draw nothing; a real target saves the pictures.
  const drawn = await app.screenshot().catch(() => null);
  return drawn?.length ? app : null;
}

test("Cupertino: the wide mail screens", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const app = await draw({ ...wide, colorScheme: scheme, ...demo });
    if (!app) return;
    await app.waitFor("text:Q4 roadmap draft", { timeout: 20000 });
    await app.screenshot(`.nsh/cup-wide-inbox-${scheme}.png`);
    await app.press("text:Q4 roadmap draft");
    await app.waitFor("id:reader >> text:Q4-roadmap.pdf");
    await app.screenshot(`.nsh/cup-wide-reader-${scheme}.png`);
    await app.press("id:reply");
    await app.waitFor("id:compose-subject");
    await app.screenshot(`.nsh/cup-wide-compose-${scheme}.png`);
  }
}, 180_000);

test("Cupertino: the wide settings and feed", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const settings = await draw({ ...wide, colorScheme: scheme, ...demo });
    if (!settings) return;
    await settings.waitFor("text:All inboxes", { timeout: 20000 });
    await settings.press("id:open-settings");
    await settings.waitFor("text:Keyboard shortcuts", { timeout: 20000 });
    await settings.wait(400);
    await settings.screenshot(`.nsh/cup-wide-settings-${scheme}.png`);

    const feed = await draw({ ...wide, colorScheme: scheme, ...demo });
    if (!feed) return;
    await feed.waitFor("text:All inboxes", { timeout: 20000 });
    await feed.press("id:rail-notifications");
    await feed.waitFor("id:notify-list >> text:CI failed on main", { timeout: 20000 });
    await feed.press("id:notify-list >> text:CI failed on main");
    await feed.waitFor("id:notify-title");
    await feed.screenshot(`.nsh/cup-wide-notifications-${scheme}.png`);
  }
}, 180_000);

test("Cupertino: the narrow mail screens", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const app = await draw({ ...narrow, colorScheme: scheme, ...demo });
    if (!app) return;
    await app.waitFor("text:All inboxes", { timeout: 20000 });
    await app.screenshot(`.nsh/cup-narrow-inbox-${scheme}.png`);
    await app.press("text:Q4 roadmap draft");
    await app.waitFor("id:reader >> text:Q4-roadmap.pdf");
    await app.screenshot(`.nsh/cup-narrow-reader-${scheme}.png`);
    await app.press("id:reply");
    await app.waitFor("id:compose-subject");
    await app.screenshot(`.nsh/cup-narrow-compose-${scheme}.png`);
  }
}, 180_000);

test("Cupertino: the narrow feed, mailboxes and settings", async () => {
  for (const scheme of ["light", "dark"] as const) {
    const feed = await draw({ ...narrow, colorScheme: scheme, ...demo });
    if (!feed) return;
    await feed.waitFor("text:All inboxes", { timeout: 20000 });
    await feed.press("label:Notifications");
    await feed.waitFor("id:notify-list >> text:CI failed on main", { timeout: 20000 });
    await feed.screenshot(`.nsh/cup-narrow-notifications-${scheme}.png`);

    const boxes = await draw({ ...narrow, colorScheme: scheme, ...demo });
    if (!boxes) return;
    await boxes.waitFor("text:All inboxes", { timeout: 20000 });
    await boxes.press("label:Mailboxes");
    await boxes.waitFor("text:On this device", { timeout: 20000 });
    await boxes.screenshot(`.nsh/cup-narrow-mailboxes-${scheme}.png`);

    const settings = await draw({ ...narrow, colorScheme: scheme, ...demo });
    if (!settings) return;
    await settings.waitFor("text:All inboxes", { timeout: 20000 });
    await settings.press("label:Settings");
    await settings.waitFor("text:Keyboard shortcuts", { timeout: 20000 });
    await settings.screenshot(`.nsh/cup-narrow-settings-${scheme}.png`);
  }
}, 180_000);
