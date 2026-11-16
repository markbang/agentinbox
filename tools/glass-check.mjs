// The floating layer, measured on the emulator's frames: the tab bar is an inset
// capsule of glass (not a slab across the screen), it minimises to a pill around
// the chosen tab as the page scrolls down, and the page shows either side of it.
//
//   node tools/glass-check.mjs <dir the Android frames are in>
//
// Reads the frames .github/android-ui.py writes; a missing frame is reported, not
// failed, so the checks can run on a partial set. Exits 1 when a frame disagrees.
import { readPng } from "../vendor/nsh-cupertino/tools/png.mjs";
import { existsSync } from "node:fs";

const dir = process.argv[2] ?? "screens";
const failures = [];
const log = (...a) => console.log("glass:", ...a);

/** The page behind the bar: a column of pixels the bar cannot cover, on the row the bar sits on. */
const shades = (png, y, from, to) => {
  const seen = new Set();
  for (let x = from; x < to; x++) seen.add(png.pixel(x, y).join(","));
  return seen.size;
};

/** How wide the bar's lit run is on `y`: the pixels at least `step` brighter than the page's own. */
function run(png, y, base, step = 0.08) {
  let start = -1;
  let end = -1;
  for (let x = 0; x < png.width; x++) {
    const lit = png.luminance(x, y) - base >= step;
    if (lit && start < 0) start = x;
    if (lit) end = x;
  }
  return { start, end, width: start < 0 ? 0 : end - start + 1 };
}

function frame(name, check) {
  const file = `${dir}/${name}.png`;
  if (!existsSync(file)) {
    log(`${name}: missing`);
    return;
  }
  const png = readPng(file);
  const scale = png.width / 412;
  const fail = (what) => failures.push(`${name}: ${what}`);
  try {
    check(png, scale, fail, name);
  } catch (e) {
    fail(String(e));
  }
}

/** The bar's row: its 64 pt, 12 pt above the gesture area at the foot of the screen. */
const barRow = (png, scale) => Math.round(png.height - (12 + 32) * scale);
/** The page, sampled in the bar's own row at the very edge the capsule leaves free. */
const pageAt = (png, y, scale) => png.luminance(Math.round(4 * scale), y);

for (const mode of ["light", "dark"]) {
  // At rest at the top: the bar is an inset capsule, the page beside it, no edge effect.
  frame(`${mode}-inbox`, (png, scale, fail, name) => {
    const y = barRow(png, scale);
    const base = pageAt(png, y, scale);
    const bar = run(png, y, base);
    const inset = Math.round(20 * scale);
    if (bar.width < png.width * 0.6) fail(`the bar is ${bar.width} px wide on a ${png.width} px screen: not an expanded capsule`);
    if (bar.start < inset * 0.5) fail(`the bar starts at x=${bar.start}: it is not inset`);
    if (png.width - bar.end < inset * 0.5) fail(`the bar ends at x=${bar.end}: it is not inset`);
    if (shades(png, y, 0, Math.round(inset * 0.6)) < 2) fail("the page beside the capsule is one flat colour");
    log(`${name}: the bar runs x=${bar.start}..${bar.end} (${Math.round(bar.width / png.width * 100)} % of the width), inset ${bar.start} px`);
  });

  // Scrolled down: the bar has minimised to a pill around the chosen tab.
  frame(`${mode}-inbox-tabmin`, (png, scale, fail, name) => {
    const y = barRow(png, scale);
    const base = pageAt(png, y, scale);
    const bar = run(png, y, base);
    if (bar.width > png.width * 0.45) fail(`the bar is ${bar.width} px wide: it did not minimise`);
    if (bar.width < 24 * scale) fail(`the bar is ${bar.width} px wide: no pill left`);
    log(`${name}: the minimised pill runs x=${bar.start}..${bar.end} (${Math.round(bar.width / png.width * 100)} % of the width)`);
  });

  // Scrolled: the page shows either side of the bar and under it, and rows under the
  // group at the top are not sharp the way the rows below are.
  frame(`${mode}-inbox-scrolled`, (png, scale, fail, name) => {
    const y = barRow(png, scale);
    if (shades(png, y, 0, png.width) < 8) fail("the bar's row holds fewer than 8 shades: a flat slab");
    const inset = Math.round(20 * scale);
    const base = pageAt(png, y, scale);
    const bar = run(png, y, base);
    if (bar.start >= inset * 2 && shades(png, y, 0, inset) < 2) fail("nothing shows beside the capsule");
    log(`${name}: ${shades(png, y, 0, png.width)} shades across the bar's row`);
  });
}

if (failures.length) {
  console.log("\n" + failures.map((f) => `✗ ${f}`).join("\n"));
  process.exit(1);
}
log("ok");
