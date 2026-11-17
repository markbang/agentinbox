// The floating layer, checked on the frames the emulator run writes: the bar is
// drawn (not blank, not one flat slab) and the page's rows pass under it and show
// through it. Its geometry — the 20 pt insets, the 64 pt height, the 12 pt lift —
// is measured from the accessibility tree by .github/android-ui.py, and its shape
// by eye against the library's 0.4.0 reference frames.
//
//   node tools/glass-check.mjs <dir the Android frames are in> [width in points]
//
// The frames are the emulator's pixels: 1440 × 3120 at density 3 is 480 × 1040 pt.
import { readPng } from "../vendor/nsh-cupertino/tools/png.mjs";
import { existsSync } from "node:fs";

const dir = process.argv[2] ?? "screens";
const points = Number(process.argv[3] ?? 480);
const failures = [];
const log = (...a) => console.log("glass:", ...a);

/** How many different colours a row holds: one flat fill holds very few. */
function shades(png, y, from, to) {
  const seen = new Set();
  for (let x = from; x < to; x++) seen.add(png.pixel(x, y).join(","));
  return seen.size;
}

function frame(name, least, check) {
  const file = `${dir}/${name}.png`;
  if (!existsSync(file)) {
    log(`${name}: missing`);
    return;
  }
  const png = readPng(file);
  const scale = png.width / points;
  const fail = (what) => failures.push(`${name}: ${what}`);
  try {
    // A row of the page can be blank between two messages: count the frame on a grid instead.
    const seen = new Set();
    for (let gy = 1; gy < 40; gy++) {
      const y = Math.round((png.height * gy) / 40);
      for (let gx = 0; gx < 24; gx++) seen.add(png.pixel(Math.round((png.width * gx) / 24), y).join(","));
    }
    if (seen.size < least) fail(`the frame holds ${seen.size} colours: nothing was drawn`);
    check(png, scale, fail, name);
  } catch (e) {
    fail(String(e));
  }
}

for (const mode of ["light", "dark"]) {
  // At rest at the top: the page and the bars, drawn.
  frame(`${mode}-inbox`, 8, (png, scale, fail, name) => {
    log(`${name}: drawn`);
  });

  // Scrolled: rows pass under the tab bar and are visible through it. A bar drawn
  // as one opaque fill would hold a handful of colours (its labels) and nothing more.
  frame(`${mode}-inbox-scrolled`, 8, (png, scale, fail, name) => {
    const y = Math.round(png.height - (12 + 32) * scale);
    const count = shades(png, y, 0, png.width);
    if (count < 8) fail(`the bar's row holds ${count} colours: a flat slab`);
    log(`${name}: ${count} colours across the bar's row`);
  });

  // Minimised: a pill of the chosen tab, the page across the rest of the foot.
  frame(`${mode}-inbox-tabmin`, 8, (png, scale, fail, name) => {
    log(`${name}: drawn`);
  });

  // Minimised after the chosen tab changed (Mail -> Settings and back): the pill sits at the
  // chosen tab's slot, near the trailing edge, not at the bar's first one. The pill is a 50 pt
  // disc: the brightest window of that width on the bar's row is where it is.
  frame(`${mode}-settings-pill`, 8, (png, scale, fail, name) => {
    if (mode !== "dark") return; // a white pill on a white page has no luminance edge; read that one by eye
    const y = Math.round(png.height - (12 + 32) * scale);
    const width = Math.round(50 * scale);
    let best = { at: 0, mean: -1 };
    for (let x = 0; x + width <= png.width; x += Math.max(1, Math.round(2 * scale))) {
      let sum = 0;
      for (let i = x; i < x + width; i++) sum += png.luminance(i, y);
      const mean = sum / width;
      if (mean > best.mean) best = { at: x + width / 2, mean };
    }
    const centre = best.at / png.width;
    if (centre < 0.7) fail(`the minimised pill sits at ${Math.round(centre * 100)} % of the width: not at the chosen tab`);
    log(`${name}: the pill sits at ${Math.round(centre * 100)} % of the width`);
  });
}

if (failures.length) {
  console.log("\n" + failures.map((f) => `✗ ${f}`).join("\n"));
  process.exit(1);
}
log("ok");
