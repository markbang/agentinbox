// Cloud mode end to end: two copies of the app, Alice's and Bob's, against
// a running agentinbox-server on 127.0.0.1:18080 whose mailboxes are
// GreenMail's (IMAPS 3993, SMTPS 3465, auth disabled). `.e2e/run.sh` starts
// both and runs this file; `nsh test` does not look in hidden directories.
// A test file has no network of its own, so everything goes through the apps.
import { expect, open, test, type App } from "nsh/test";

const server = "http://127.0.0.1:18080";
const greenmail = "127.0.0.1";
const desktop = { platform: "linux", width: 1280, height: 820, locale: "en-US", network: "live" } as const;
const slow = { timeout: 30_000 };

/** Opens the app and signs up on the server as `email`. */
async function signUp(email: string) {
  const app = await open("../App.tsx", desktop);
  await app.waitFor("id:onboarding");
  await app.press("text:Through an AgentInbox server");
  await app.press("text:Create account");
  await app.clear("id:server");
  await app.type("id:server", server);
  await app.type("id:cloud-email", email);
  await app.type("id:cloud-password", "correct horse battery");
  await app.press("id:onboarding-go");
  await app.waitFor("id:open-settings", slow);
  expect(app.storage()["nshmail.mode"]).toBe("cloud");
  // Headless hosts keep no files: the session is in the app's storage, as on the web.
  expect(app.storage()["nshmail.cloud.token"]).toBeTruthy();
  return app;
}

async function openAddAccount(app: App) {
  await app.press("id:open-settings");
  await app.waitFor("id:signed-in-as");
  // The empty mailbox behind the sheet offers Add account too, until an account exists.
  await app.press("text:Add account >> nth=1").catch(() => app.press("text:Add account"));
}

/** Adds the GreenMail mailbox `email` from the add-account page. */
async function addMailbox(app: App, email: string) {
  await app.press("id:add-imap");
  await app.type("id:imap-email", email);
  await app.press("id:imap-continue");
  await app.waitFor("id:imap-password", slow);
  for (const [id, value] of [
    ["imap-host", greenmail],
    ["imap-port", "3993"],
    ["smtp-host", greenmail],
    ["smtp-port", "3465"],
  ]) {
    await app.clear(`id:${id}`);
    await app.type(`id:${id}`, value);
  }
  await app.type("id:imap-password", "app-password");
  await app.press("id:imap-add");
  await app.waitFor(`text:Added ${email}`, slow);
  await app.waitFor("id:modal", { state: "gone" });
  await app.waitFor(`text:${email}`);
}

async function send(app: App, to: string, subject: string) {
  await app.press("id:compose");
  await app.type("id:compose-to", to);
  await app.type("id:compose-subject", subject);
  await app.type("id:compose-body", `${subject}, from Bob.`);
  await app.press("id:send");
  await app.waitFor("text:Message sent", slow);
}

test("cloud mode: sign up, add a mailbox, read, get new mail live, reply, sign out", async () => {
  const run = Date.now();
  const alice = `alice${run}@test.local`;
  const bob = `bob${run}@test.local`;

  const bobs = await signUp(bob);
  await openAddAccount(bobs);
  await addMailbox(bobs, bob);
  await send(bobs, alice, "Hello before you joined");

  const alices = await signUp(alice);

  // Android's Gradle host hands over its FCM token; cloud mode registers it.
  await alices.host.send("push.token", { kind: "fcm", token: `fcm-${run}` });
  await alices.waitUntil(() => alices.requests().some((r) => r.method === "POST" && r.url === `${server}/v1/devices`));
  expect(alices.requests().find((r) => r.url === `${server}/v1/devices`)?.body).toBe(`{"kind":"fcm","token":"fcm-${run}"}`);

  // A provider's sign-in opens the server's start page and comes back on
  // nshmail://oauth-done, here with the error of a server without Google.
  await openAddAccount(alices);
  await alices.press("id:add-google");
  await alices.waitUntil(() => alices.openedUrls().length > 0);
  expect(alices.openedUrls()[0]).toMatch(/^http:\/\/127\.0\.0\.1:18080\/v1\/oauth\/google\/start\?token=[^&]+&return=native$/);
  await alices.openWithUrl("nshmail://oauth-done?error=google+sign-in+is+not+configured+on+this+server");
  await alices.waitFor("text:/google sign-in is not configured on this server/");

  // The server syncs the new mailbox; its events reload the list.
  await addMailbox(alices, alice);
  await alices.waitFor("id:messages >> text:Hello before you joined", slow);

  // Her signature is kept on the server: another copy of the app finds it there.
  await alices.press("id:open-settings");
  await alices.press("id:account-more-0");
  await alices.press("text:Signature…");
  await alices.type("id:signature-text", "*Alice*");
  await alices.press("id:signature-save");
  await alices.waitFor("text:Signature saved", slow);
  await alices.press("id:modal-done");
  await alices.waitFor("id:modal", { state: "gone" });
  const again = await open("../App.tsx", { ...desktop, storage: alices.storage() });
  await again.waitFor("id:open-settings", slow);
  await again.press("id:open-settings");
  await again.press("id:account-more-0");
  await again.press("text:Signature…");
  expect(again.value("id:signature-text")).toBe("*Alice*");

  // New mail arrives over the event stream: nothing in Alice's app asks for it.
  await send(bobs, alice, "Lunch at noon?");
  await alices.waitFor("id:messages >> text:Lunch at noon?", slow);

  await alices.press("id:messages >> text:Lunch at noon?");
  await alices.press("id:reply");
  await alices.waitFor("id:compose-body");
  expect(alices.value("id:compose-body")).toMatch(/^\n\n-- \nAlice\n\nOn /);
  await alices.type("id:compose-body", "Sounds good.");
  // The server holds it for the undo delay: Undo takes it back from there.
  await alices.press("id:send");
  await alices.waitFor("text:Sending…", slow);
  await alices.press("id:toast-action");
  await alices.waitFor("id:compose-body", slow);
  expect(alices.value("id:compose-body")).toMatch(/Sounds good\./);
  await alices.press("id:send");
  await alices.waitFor("text:Message sent", slow);
  // Bob's inbox lists the reply in the conversation his question started.
  await bobs.waitFor("id:messages >> text:Lunch at noon?", slow);
  await bobs.waitFor("id:messages >> id:thread-count", slow);

  // Signing out ends the session on the server and on the device.
  await bobs.press("id:open-settings");
  await bobs.press("text:Sign out");
  await bobs.waitFor("text:Sign out of AgentInbox?", slow);
  await bobs.press("text:Sign out >> nth=1");
  await bobs.waitFor("id:onboarding", slow);
  expect(bobs.storage()["nshmail.mode"]).toBeUndefined();
  expect(bobs.storage()["nshmail.cloud.token"]).toBeUndefined();
}, 240_000);

test("cloud mode: attachments upload in chunks, arrive whole, forward, and stay under the limit", async () => {
  const run = Date.now();
  const alice = `alice${run}a@test.local`;
  const bob = `bob${run}a@test.local`;
  const bobs = await signUp(bob);
  await openAddAccount(bobs);
  await addMailbox(bobs, bob);
  const alices = await signUp(alice);
  await openAddAccount(alices);
  await addMailbox(alices, alice);

  const report = new Uint8Array(1536 * 1024).map((_, i) => (i * 7) % 251);
  let huge = false;
  bobs.onPick(() =>
    huge
      ? [{ name: "footage.mov", type: "video/quicktime", data: new Uint8Array(26 * 1024 * 1024) }]
      : [
          { name: "2026年第三季度报告.pdf", type: "application/pdf", data: report },
          { name: "截图.png", type: "image/png", data: new Uint8Array(4096).fill(7) },
        ],
  );
  await bobs.press("id:compose");
  await bobs.type("id:compose-to", alice);
  await bobs.type("id:compose-subject", "Quarterly report");
  await bobs.press("id:compose-attach");
  await bobs.waitFor("id:compose-attachments >> text:1.5 MB", slow);
  await bobs.waitFor("id:compose-attachments >> text:4 KB", slow);
  // The report went in two chunks, each after the last.
  const chunks = bobs.requests().filter((r) => r.method === "PATCH" && r.url.startsWith(`${server}/v1/uploads/`));
  expect(chunks.map((r) => new URL(r.url).searchParams.get("offset")).sort()).toEqual(["0", "0", "1048576"]);

  huge = true;
  await bobs.press("id:compose-attach");
  await bobs.waitFor("text:/^Attachments can add up to 25.0 MB/");
  await bobs.press("id:send");
  await bobs.waitFor("text:Message sent", slow);

  await alices.waitFor("id:messages >> text:Quarterly report", slow);
  await alices.press("id:messages >> text:Quarterly report");
  await alices.waitFor("id:reader >> text:2026年第三季度报告.pdf", slow);
  await alices.waitFor("id:reader >> text:截图.png");
  await alices.press("id:forward");
  await alices.waitFor("id:compose-attachments >> text:截图.png");
  await alices.press("label:Remove 截图.png");
  await alices.type("id:compose-to", bob);
  await alices.press("id:send");
  await alices.waitFor("text:Message sent", slow);

  // The forward joins Bob's conversation and opens expanded; his own message is collapsed above it.
  await bobs.waitFor("id:messages >> id:thread-count", slow);
  await bobs.press("id:messages >> text:Quarterly report");
  await bobs.waitFor("id:reader >> text:2026年第三季度报告.pdf", slow);
  expect(bobs.shows("id:reader >> text:截图.png")).toBe(false);
  await bobs.waitFor("id:thread-older >> text:me", slow);
  await bobs.press("id:thread-older >> text:me");
  await bobs.waitFor("id:reader >> text:截图.png", slow);
}, 240_000);

/** A real request: the test's process has no network, so `.e2e/hook.tsx` makes it with the app's. */
async function request(method: string, url: string, headers: Record<string, string> = {}, body?: string) {
  const app = await open("./hook.tsx", {
    ...desktop,
    storage: { "hook.request": JSON.stringify({ method, url, headers, body }) },
  });
  await app.waitFor("text:/^status /", slow);
  const answer = app.texts().find((text) => text.startsWith("status ") || text.startsWith("error ")) ?? "";
  const [status, ...rest] = answer.split("\n");
  return { status, body: rest.join("\n") };
}

test("cloud mode: a webhook lands live in the feed, reads, archives, and an agent's key reads it", async () => {
  const run = Date.now();
  const alices = await signUp(`alice${run}n@test.local`);

  // Settings → Sources → Add: a webhook, whose ingest URL the server answers once.
  await alices.press("id:open-settings");
  await alices.press("text:Sources");
  await alices.waitFor("text:Your sources");
  await alices.press("id:sources-add-top");
  await alices.press("text:Webhook");
  await alices.type("id:source-name", "Deploys");
  await alices.press("id:source-create");
  await alices.waitFor("id:source-url", slow);
  const hook = alices.texts().find((text) => /^https?:\/\/[^\s]+\/hooks\/\S+$/.test(text));
  expect(hook).toBeTruthy();
  await alices.press("id:source-done");
  await alices.press("label:Back");
  await alices.press("id:modal-done");
  await alices.waitFor("id:modal", { state: "gone" });

  // The feed is empty and the rail says so before anything arrives.
  await alices.press("id:rail-notifications");
  await alices.waitFor("id:notify-list");
  expect(alices.shows("id:notify-list >> text:Deploy finished")).toBe(false);

  // A service posts to the URL: the notification reaches the feed live, over the stream.
  const posted = await request(
    "POST",
    hook!,
    { "content-type": "application/json" },
    JSON.stringify({ title: "Deploy finished", message: "AgentInbox 0.0.4 is live on every target", priority: 7 }),
  );
  expect(posted.status).toBe("status 202");
  await alices.waitFor("id:notify-list >> text:Deploy finished", slow);
  // Its source's chip carries it, so the feed knows the source the server made.
  await alices.waitFor("text:Deploys");

  // Opening it marks it read on the server, as the mail list does.
  await alices.press("id:notify-list >> text:Deploy finished");
  await alices.waitFor("id:notify-body", slow);
  expect(alices.texts().some((text) => text.includes("live on every target"))).toBe(true);
  await alices.waitUntil(() => alices.requests().some((r) => r.method === "POST" && r.url === `${server}/v1/feed/read`), slow);

  // Archiving takes it out of the feed once Undo has passed, on the server too.
  await alices.press("id:notify-archive");
  await alices.waitUntil(() => alices.requests().some((r) => r.method === "POST" && r.url === `${server}/v1/feed/archive`), slow);
  await alices.waitFor("id:notify-list >> text:Deploy finished", { state: "gone", timeout: 30_000 });

  // An agent's key: created in Settings, then used against the REST API for real.
  await alices.press("id:open-settings");
  await alices.press("id:settings-keys");
  await alices.press("id:keys-add-top");
  await alices.type("id:key-name", "Deploy bot");
  await alices.press("id:key-write");
  await alices.press("id:key-create");
  await alices.waitFor("id:key-token", slow);
  const key = alices.texts().find((text) => text.startsWith("nb_"));
  expect(key).toBeTruthy();

  // A second notification, read back with the key: the feed, its unread count and its source.
  const again = await request("POST", hook!, { "content-type": "application/json" }, JSON.stringify({ title: "Nightly build passed" }));
  expect(again.status).toBe("status 202");
  const read = await request("GET", `${server}/v1/feed?unread=1`, { authorization: `Bearer ${key}` });
  expect(read.status).toBe("status 200");
  expect(read.body).toContain("Nightly build passed");
  expect(read.body).toContain('"unread":1');
  // The archived one is out of the default view.
  expect(read.body).not.toContain("Deploy finished");
}, 240_000);
