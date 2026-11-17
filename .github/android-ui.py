#!/usr/bin/env python3
"""Drives AgentInbox on a running emulator and screenshots it: the light walk through every screen —
inbox, swipe to archive and Undo, selection, pull to refresh, reader, a conversation, compose,
Schedule send, search, mailboxes, Scheduled, settings, a signature, a tab switch that keeps the
inbox's scroll position — then the dark pass over the surfaces dark is its own design on, then
larger text and a tablet-sized screen.

Usage: android-ui.py <dir with the APK> <screenshot dir>

Nothing here sleeps to let the app catch up: every wait ends on its condition. A control is waited
for by polling the accessibility dump four times a second, an animation by two identical frames, a
page that stopped moving by two identical dumps, a search result by its result count. Each step has
a 2-minute budget and the drive DRIVE_BUDGET seconds (default 660, set by the workflow); the first
failure stops the drive, prints `FAILED-STEP: <step>`, and leaves a screenshot, the dump, the
logcat since the step began and the step times beside the screens, which the job uploads.
"""
import glob
import os
import re
import subprocess
import sys
import time
import traceback
import xml.etree.ElementTree as ET

PKG = "top.bangwu.nshmail"
POLL = 0.25  # how often a wait looks again; it ends on its condition, never on the clock
STEP_BUDGET = 120
DRIVE_BUDGET = float(os.environ.get("DRIVE_BUDGET", "660"))

START = time.time()
# The drive's own clock starts once the emulator has booted: boot is bounded by its own wait.
BEGIN = START
STEP, STEP_AT, STEP_END = "start", START, START + STEP_BUDGET
mode, out, w, h = "start", "screens", 1440, 3120
DENSITY = 3.0  # pixels per point, from the device's own dpi, once it is known
failures, steps = [], []  # steps: (name, seconds), for the run log
_dump, _dump_at, _nodes = "", 0.0, []


class Failure(Exception):
    """The app did not do what the step asked: stop, keep the evidence, exit non-zero."""


class Timeout(Failure):
    """A step, or the whole drive, used up its budget."""


def guard():
    now = time.time()
    if now > STEP_END:
        raise Timeout(f"{STEP} took longer than {STEP_BUDGET} s")
    if now > BEGIN + DRIVE_BUDGET:
        raise Timeout(f"the drive reached its {DRIVE_BUDGET:.0f} s cap at {STEP}")


def mark(name):
    """Starts a step: its budget, and the log line that names it."""
    global STEP, STEP_AT, STEP_END
    if STEP != "start":
        steps.append((STEP, time.time() - STEP_AT))
    STEP, STEP_AT, STEP_END = name, time.time(), time.time() + STEP_BUDGET
    print(f"step {name} at {time.time() - START:.1f} s", flush=True)


def raw(*args):
    """adb for evidence: it must work even when the step's budget is gone."""
    return subprocess.run(["adb", *args], check=False, capture_output=True, encoding="utf-8", errors="replace").stdout


def adb(*args, check=True):
    guard()
    return subprocess.run(["adb", *args], check=check, capture_output=True, encoding="utf-8", errors="replace").stdout


def frame():
    """The screen as PNG bytes."""
    guard()
    return subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, capture_output=True).stdout


def nodes(max_age=POLL):
    """The screen's nodes in one adb call, reused while the dump is younger than `max_age`.
    A failed dump leaves the node list empty, never the previous screen's."""
    global _dump, _dump_at, _nodes
    guard()
    if _dump and time.time() - _dump_at <= max_age:
        return _nodes
    # One round trip for a fresh dump: the file is removed first, so a dump that fails cannot be
    # mistaken for the screen that was there before it. uiautomator waits for the window to go idle
    # before it dumps, and a blinking cursor or a spinner can outlast that wait: the dump then comes
    # back empty, which must not cost the caller its wait — it is asked for again, twice.
    for attempt in range(1, 4):
        xml = subprocess.run(
            ["adb", "exec-out", "rm -f /sdcard/ui.xml; uiautomator dump --compressed /sdcard/ui.xml >/dev/null 2>&1; cat /sdcard/ui.xml"],
            check=False,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        ).stdout
        if xml.strip().startswith("<?xml"):
            break
        print("the dump came back empty, asking again", flush=True)
        time.sleep(POLL)
    _dump_at = time.time()
    if not xml.strip().startswith("<?xml"):
        _nodes = []
        return _nodes
    _dump = xml
    try:
        _nodes = list(ET.fromstring(xml).iter("node"))
    except ET.ParseError:
        _nodes = []
    return _nodes


def matches(n, key):
    rid, text, desc = n.get("resource-id", ""), n.get("text", ""), n.get("content-desc", "")
    if key.startswith("id:"):
        return re.fullmatch(key[3:], rid) is not None
    return key in (text, desc)


def box(n):
    """The node's bounds, or None while it has no area (laid out, not painted)."""
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds", "0")))
    return (x1, y1, x2, y2) if x2 > x1 and y2 > y1 else None


def centre(n):
    x1, y1, x2, y2 = box(n)
    return (x1 + x2) // 2, (y1 + y2) // 2


def poll(probe, timeout, anr=False):
    """`probe()`'s value as soon as it is not None, else None at the deadline. Not truthiness: an
    ElementTree node with no children is falsy, and those are the nodes a tap looks for."""
    end = time.time() + timeout
    while True:
        found = probe()
        if found is not None:
            return found
        if time.time() >= end:
            return None
        if anr:
            dismiss_anr()
        time.sleep(POLL)


def find(key, timeout=15):
    """`key`'s node once it is on screen; every lookup waits for it, none assumes a paint."""

    def probe():
        for n in nodes():
            if matches(n, key) and box(n):
                return n
        return None

    return poll(probe, timeout, anr=True) if timeout > 1 else poll(probe, timeout)


def gone(key, timeout=10):
    """True once `key` has left the screen (a snackbar, a dialog)."""
    return poll(lambda: True if not any(matches(n, key) and box(n) for n in nodes()) else None, timeout) is True


def wait(key, timeout=15):
    if find(key, timeout) is None:
        raise Failure(f"never showed: {key}")


def text_of(key, timeout=10):
    n = find(key, timeout)
    return (n.get("text") or n.get("content-desc")) if n is not None else None


def changed(key, before, timeout=8):
    """True once `key` says something other than `before` (the selection's count, say)."""
    return poll(lambda: True if (text_of(key, 0.5) or before) != before else None, timeout) is True


def tap(key, timeout=15):
    n = find(key, timeout)
    if n is None:
        raise Failure(f"not found: {key}")
    x, y = centre(n)
    adb("shell", "input", "tap", str(x), str(y))


def tap_until(key, expect, tries=2, timeout=8):
    """Taps `key` until `expect` shows. The tap gets the whole `timeout` before it is repeated: a
    sheet that opens slowly must not be closed again by the next tap, and half these controls are
    toggles. A tap that took — what it pressed is gone from the screen — is waited for longer still,
    since the page it opened may only be sliding in."""
    for attempt in range(1, tries + 1):
        tap(key)
        if find(expect, timeout) is not None:
            return
        if find(key, 1) is None and find(expect, timeout) is not None:
            return
        print(f"the tap on {key} did not show {expect} (attempt {attempt})", flush=True)
    raise Failure(f"tapping {key} never showed {expect}")


def sheet(key, item, tries=3, timeout=15):
    """Opens the sheet `key` shows, and waits for one of its items: a tap that opens nothing is
    repeated, since these sheets are the app's flakiest controls. False when it never opened."""
    for attempt in range(1, tries + 1):
        tap(key)
        if find(item, timeout) is not None:
            return True
        print(f"the sheet behind {key} did not open (attempt {attempt})", flush=True)
    return False


def select_first_row(timeout=6):
    """The first row into the selection, and the bar's own count as the proof: the tap right after
    `select-rows` lands before the selection bar is laid out now and then, and a Delete on an empty
    selection does nothing at all."""
    tap_until("id:select-rows", "id:selection-count", tries=2, timeout=timeout)
    zero = text_of("id:selection-count", 5)
    for attempt in range(1, 3):
        tap("id:message-.*")
        if zero is None or changed("id:selection-count", zero, timeout):
            return
        print("the row was not added to the selection, tapping again", flush=True)
    raise Failure("the row was never added to the selection")



def steady(before=None, timeout=6):
    """Until two screenshots in a row are the same, and not `before`: a fade or a theme swap is a
    pixel change the dump cannot see. Returns the frame that settled."""
    end, last = time.time() + timeout, None
    while time.time() < end:
        now = frame()
        if now and now != before and now == last:
            return now
        last = now
        time.sleep(POLL)
    print("the screen never settled, going on", flush=True)
    return last


def first_change(before, timeout=3):
    """The first frame that is not `before`: what a gesture or a spinner drew."""
    end, now = time.time() + timeout, before
    while time.time() < end:
        now = frame()
        if now != before:
            return now
        time.sleep(0.08)
    return now


def save(name, png):
    with open(os.path.join(out, f"{name}.png"), "wb") as f:
        f.write(png)
    print("shot", name, flush=True)


def shot(name):
    save(name, steady())


def during(gesture, name, timeout=3):
    """Screenshots `name` while `gesture` (an `adb shell input` command) is under way: the frame
    the gesture drew, taken as soon as the screen changes."""
    before = frame()
    p = subprocess.Popen(["adb", "shell", "input", *gesture])
    try:
        drew = first_change(before, timeout)
    finally:
        p.wait()
    save(name, drew)


def loading_shot(name, trigger):
    """Screenshots `name` while the refresh `trigger` started runs: the frame that shows the
    indicator, taken as soon as the tap draws one (the demo's refresh waits 800 ms)."""
    before = frame()
    tap(trigger)
    save(name, first_change(before, 3))
    gone("id:refreshing", 10) or gone("id:notify-refreshing", 10)


def swipe(x1, y1, x2, y2, ms):
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms))


def dismiss_anr():
    """The emulator's own apps (the launcher) sometimes stop responding: wait for them, keep going."""
    for n in nodes():
        if n.get("resource-id") == "android:id/aerr_wait" and box(n):
            x, y = centre(n)
            adb("shell", "input", "tap", str(x), str(y))
            print("dismissed a system ANR dialog", flush=True)
            return True
    return False


TABS = {"Mail": 0, "Notifications": 1, "Search": 2, "Mailboxes": 3, "Settings": 4}



def points(px):
    return px / DENSITY


def tab_bar():
    """The bar's box: the floating capsule's own node (20 pt in from the sides, 64 pt tall, 12 pt
    above the foot), or, when the dump carries none, the extent of its tabs' buttons."""
    found = nodes()
    for n in found:
        if n.get("resource-id") == "tab-bar" and box(n):
            return box(n)
    for n in found:
        if (n.get("content-desc") or n.get("text")) == "Tabs" and box(n):
            return box(n)
    labels = set(TABS)
    items = [box(n) for n in found if n.get("clickable") == "true" and (n.get("text") in labels or n.get("content-desc") in labels) and box(n)]
    if not items:
        return None
    return (min(b[0] for b in items), min(b[1] for b in items), max(b[2] for b in items), h)


def bar_box():
    """The tab bar's own node, and only that: while the keyboard is up the bar is hidden, and a
    fallback would read the page instead."""
    for n in nodes():
        if n.get("resource-id") == "tab-bar" and box(n):
            return box(n)
    return None


def bar_geometry():
    """The floating tab bar's shape, from the accessibility tree: 20 pt in from the sides, 64 pt
    tall, 12 pt above the home indicator (nsh-cupertino's GlassTabBar). A bar drawn edge to edge,
    or as a band, is what this catches."""
    bar = tab_bar()
    if not bar:
        raise Failure("the tab bar is not in the accessibility tree")
    foot = bar[3] if bar[3] <= h else h
    density = DENSITY
    top, left, right = bar[1], bar[0], bar[2]
    print(
        f"tab bar: x {left}..{right} of {w}, y {top}..{foot} of {h}"
        f" — side insets {round(left / density)}/{round((w - right) / density)} pt,"
        f" {round((foot - top) / density)} pt tall, {round((h - foot) / density)} pt from the foot",
        flush=True,
    )
    for what, got, want in (("left inset", left / density, 20), ("right inset", (w - right) / density, 20)):
        if abs(got - want) > 4:
            raise Failure(f"the tab bar's {what} is {round(got)} pt, not {want}")
    # Minimised, the bar travels 6 pt toward the foot (UIKit's shrink), so 6..12 is its own room.
    if not 5 <= (h - foot) / density <= 13:
        raise Failure(f"the tab bar sits {round((h - foot) / density)} pt above the foot, not 6..12")
    if abs((foot - top) / density - 64) > 6:
        raise Failure(f"the tab bar is {round((foot - top) / density)} pt tall, not 64")
    return (left, top, right, foot)


def expanded_bar():
    """The bar's box once it holds all its tabs. Minimised it is a pill around the chosen tab, with
    no room for five: a tap on the pill brings the bar back, and only then does a tab have a place."""
    bar = tab_bar()
    if bar and points(bar[2] - bar[0]) < 300:
        adb("shell", "input", "tap", str((bar[0] + bar[2]) // 2), str((bar[1] + bar[3]) // 2))
        steady(timeout=2)
        bar = tab_bar()
    return bar


def tab(name, expect, tries=2):
    """Taps a tab by its place in the bar, clear of the system's gesture area, until `expect` shows."""
    for attempt in range(1, tries + 1):
        bar = expanded_bar()
        if bar:
            x1, y1, x2, _ = bar
            x, y = x1 + (2 * TABS[name] + 1) * (x2 - x1) // 10, (y1 + bar[3]) // 2
        else:
            x, y = w * (2 * TABS[name] + 1) // 10, h - 100
        adb("shell", "input", "tap", str(x), str(y))
        if find(expect, 8) is not None:
            return
        print(f"the tap on the {name} tab did not show {expect} (attempt {attempt})", flush=True)
    raise Failure(f"the {name} tab never showed {expect}")


def scroll_up_to(key, tries=4, timeout=2):
    """A row above the fold: swipes the page down until `key` shows."""
    for _ in range(tries):
        if find(key, timeout) is not None:
            return True
        before = steady(timeout=2)
        swipe(w // 2, h * 4 // 10, w // 2, h * 8 // 10, 300)
        if steady(before, timeout=2) == before:  # the page has nothing above it
            return False
    return find(key, timeout) is not None


def scroll_to(key, tries=4, timeout=2):
    """A row below the fold: swipes the page up until `key` shows."""
    for _ in range(tries):
        if find(key, timeout) is not None:
            return True
        before = steady(timeout=2)
        swipe(w // 2, h * 8 // 10, w // 2, h * 4 // 10, 300)
        if steady(before, timeout=2) == before:  # the page has nothing below it
            return False
    return find(key, timeout) is not None


def scroll_to_end(tries=5):
    """Swipes the page up until nothing moves: the end of its content."""
    for _ in range(tries):
        before = steady(timeout=2)
        swipe(w // 2, h * 8 // 10, w // 2, h * 4 // 10, 300)
        if steady(before, timeout=2) == before:
            return


def back():
    """Android's back, then until the screen it left behind stops drawing: a frame pair, cheaper
    than a pair of dumps, and the next lookup re-reads the nodes anyway."""
    adb("shell", "input", "keyevent", "4")
    steady(timeout=3)


def back_to(key, tries=3, timeout=4):
    """Back until `key` shows: a page's keyboard takes the first Back, the page the next."""
    for _ in range(tries):
        if find(key, timeout) is not None:
            return True
        back()
    return find(key, timeout) is not None


def close_compose(tries=3):
    """Compose is a sheet over the inbox now, so id:messages is behind it and says nothing about it:
    back until the composer's own page is gone."""
    for _ in range(tries):
        if find("id:compose-page", 2) is None:
            return
        back()
    if find("id:compose-page", 2) is not None:
        print("the composer stayed open", flush=True)


def booted(timeout=240):
    """Boot is done for the user, not just the kernel: until then "Pixel is starting…" covers the screen."""
    adb("wait-for-device")
    end = time.time() + timeout
    while time.time() < end:
        done = adb("shell", "getprop sys.boot_completed; getprop init.svc.bootanim; getprop sys.user.0.ce_available", check=False).split()
        if done[:1] == ["1"] and done[1:2] in (["stopped"], [""]) and done[2:3] == ["true"]:
            break
        time.sleep(1)
    else:
        raise Failure(f"the emulator did not finish booting in {timeout} s")
    # Right after boot the system compiles and indexes: wait (bounded) for the load to drop.
    cpus = adb("shell", "nproc", check=False).strip()
    cpus = int(cpus) if cpus.isdigit() else 2
    end = time.time() + 60
    while time.time() < end:
        try:
            load = float(adb("shell", "cat", "/proc/loadavg", check=False).split()[0])
        except (IndexError, ValueError):
            break
        if load < cpus * 1.5:
            print("booted, load", load, "on", cpus, "cpus", flush=True)
            return
        time.sleep(2)
    print("booted, the load stayed above", cpus * 1.5, "- going on", flush=True)


def launch():
    """The inbox, from a cold app: force-stop, start, and wait for its rows rather than a clock."""
    for attempt in range(1, 3):
        adb("shell", "am", "force-stop", PKG)
        adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
        if find("id:messages", 60) is not None:
            steady(timeout=3)  # the rows still sliding in, before anything is tapped
            return
        print(f"start {attempt} never reached the inbox", flush=True)
    raise Failure("the app never reached the inbox")


def row_settled(timeout=6):
    """The first row's box once it stops moving: a cold start on a slow emulator is still sliding in."""
    end, last = time.time() + timeout, None
    while time.time() < end:
        row = next((n for n in nodes() if re.fullmatch(r"message-.*", n.get("resource-id", ""))), None)
        now = box(row) if row is not None else None
        if now and now == last:
            return now
        last = now
        time.sleep(POLL)
    return last


def settings_bottom(name):
    """The settings list at its end, with the numbers the tab bar's room needs: the last row (the
    version line, under Keyboard shortcuts) ends above the bar's top, not under it."""
    scroll_to_end()
    shot(name)
    bar = tab_bar()
    found = nodes()
    inside_bar = lambda n: bar is not None and box(n) and box(n)[1] >= bar[1]
    lowest = None
    for n in found:
        text = (n.get("text") or n.get("content-desc") or "").strip()
        if not text or box(n) is None or inside_bar(n):
            continue
        if lowest is None or box(n)[3] > box(lowest)[3]:
            lowest = n
    if lowest is None or bar is None:
        print("settings bottom: no row box or no tab bar to compare", flush=True)
        return
    text, bounds = (lowest.get("text") or lowest.get("content-desc"), box(lowest))
    print(f"settings bottom: the lowest row ({text!r}) ends at {bounds[3]}, the tab bar starts at {bar[1]} ({bar[1] - bounds[3]} px of room)", flush=True)
    if bounds[3] > bar[1]:
        raise Failure(f"the last settings row goes under the tab bar by {bounds[3] - bar[1]} px")


def sign_out(name):
    """Settings' Sign out answered, then the onboarding. Each attempt starts from a fresh app, which
    puts Settings back at its top (the notification screens scroll it down) and clears what an earlier
    attempt left open. The dialog's title has to be in the dump and its fade drawn before its positive
    button (Android's last action) is tapped: a tap the emulator drops during that fade only dismisses
    the dialog, and an app wedged under it answers nothing."""
    for attempt in range(1, 3):
        if attempt > 1:
            print("signing out again, from a restarted app", flush=True)
        launch()
        tab("Settings", "id:signed-in-as")
        scroll_up_to("Sign out")
        tap("Sign out")
        wait("Sign out of AgentInbox?", 10)  # the sheet's own title, whatever it says
        if attempt == 1:
            shot(name)
        steady()
        # The sheet's action is the lowest node with that word: the row behind it is covered.
        actions = [n for n in nodes() if matches(n, "Sign out") and box(n)]
        if actions:
            x, y = centre(max(actions, key=lambda n: box(n)[3]))
            adb("shell", "input", "tap", str(x), str(y))
            if find("id:onboarding", 20) is not None:
                return True
        print(f"sign out {attempt} did not show the onboarding", flush=True)
    raise Failure("signing out never showed the onboarding")


def skip(what):
    """A screen the app would not open this run: said loudly, in the run's annotations and in the
    artifact, so it is missing on purpose and not by accident."""
    print(f"::warning title=Android UI::skipped {what}: the app did not open it this run", flush=True)
    with open(os.path.join(out, "skipped.txt"), "a") as f:
        f.write(f"{STEP}: {what}\n")


def evidence(name):
    """The screen, its dump, and what the app logged since the step began: what the next flake is
    diagnosed from. It runs on raw adb, so an expired step budget cannot hide the failure."""
    try:
        with open(os.path.join(out, f"{name}.png"), "wb") as f:
            f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], check=False, capture_output=True).stdout)
        with open(os.path.join(out, f"{name}.xml"), "w") as f:
            f.write(_dump)
        log = raw("logcat", "-d", "-v", "epoch", "-t", "1500").splitlines()
        lines = [line for line in log if line.split(" ")[0].replace(".", "", 1).isdigit() and float(line.split(" ")[0]) >= STEP_AT]
        if not lines:  # a device clock that is not the host's: the last lines still say what broke
            lines = log[-100:]
        with open(os.path.join(out, "failure-logcat.txt"), "a") as f:
            f.write(f"===== {name}: {STEP} =====\n" + "\n".join(lines[-300:]) + "\n")
        print("evidence", name, flush=True)
    except Exception as e:  # it must never hide the failure it explains
        print("no evidence for", name, "-", e, flush=True)


def drive():
    """The light walk — every screen — then the dark pass over the surfaces dark is its own design
    on, then larger text and a tablet."""
    global mode
    mode = "light"
    light_walk()
    dark_walk()
    large_and_tablet()


def light_walk():
    """Every screen, once: the functional sub-flows (folders, sources, keys, rules) are walked here,
    and the dark pass reads the shells they set up."""
    global mode
    mode = "light"
    theme = "light"
    adb("shell", "cmd", "uimode", "night", "no")

    mark(f"{theme} inbox")
    launch()
    shot(f"{theme}-inbox")
    bar_geometry()
    loading_shot(f"{theme}-refreshing", "id:refresh")

    mark(f"{theme} swipe to archive")
    # Swipe the first row right: Archive, with Undo. Swipes start mid-row: the screen's edges
    # are the system's back gesture. A full swipe needs the content to travel past 66 % of the
    # row's width (cupertino's swipe.rs): about 2/3 of the screen, clear of those edges.
    row = row_settled()
    if not row:
        raise Failure("the inbox shows no rows")
    x1, y1, x2, y2 = row
    y, mid, quarter = (y1 + y2) // 2, (x1 + x2) // 2, (x2 - x1) // 4
    undo = None
    for start, end, ms in ((120, x2 - 100, "800"), (70, x2 - 70, "1000"), (70, x2 - 70, "1600")):
        swipe(x1 + start, y, end, y, ms)
        undo = find("id:toast-action", 4)
        if undo is not None:
            break
        print(f"the swipe {start}->{end} over {ms} ms revealed without archiving", flush=True)
    if undo is None:
        raise Failure("the swipe did not archive the first row")
    # The snackbar lives seconds: the shot and the tap go straight at its own bounds.
    save(f"{theme}-archived-snackbar", frame())
    adb("shell", "input", "tap", *map(str, centre(undo)))
    gone("id:toast-action", 6)  # Undo: the row is back once its snackbar has gone
    # The swipe in flight, for the action row it reveals; Delete is not fired.
    during(["swipe", str(mid + quarter), str(y), str(mid), str(y), "1500"], f"{theme}-swipe-delete")
    gone("id:toast-action")  # the deletion's Undo leaves before the next gesture

    mark(f"{theme} selection")
    # Select, then a tap picks a row; back ends the selection.
    select_first_row()
    shot(f"{theme}-selection")
    back()

    mark(f"{theme} pull to refresh")
    during(["swipe", str(w // 2), str(y1), str(w // 2), str(y1 + h // 3), "1200"], f"{theme}-pull-refresh")

    mark(f"{theme} reader")
    tap_until("id:message-.*", "id:reader", tries=2, timeout=8)
    shot(f"{theme}-reader")
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], f"{theme}-reader-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 400)
    shot(f"{theme}-reader-scrolled")
    tap("id:message-more")
    shot(f"{theme}-reader-menu")
    # The menu is a sheet over the reader: one Back closes it, the next leaves the reader.
    if not back_to("id:messages", tries=3):
        raise Failure("the reader's menu never came back to the inbox")

    mark(f"{theme} conversation")
    # A conversation: its latest message expanded, the earlier ones collapsed above; a tap
    # expands one. The inbox may be scrolled past it: look above, and skip the screen.
    subject = "Offsite in March: Lisbon or Porto?"
    if find(subject, 2) is None:
        scroll_up_to(subject)
    if find(subject, 2) is not None:
        tap_until(subject, "id:reader", tries=2, timeout=8)
        shot(f"{theme}-reader-conversation")
        # The earlier messages collapse under a bar of their own; a tap expands them.
        tap("id:thread-older")
        wait("id:thread-newer", 8)
        shot(f"{theme}-thread-older")
        back()
        wait("id:messages")
    else:
        print("the conversation row is not on screen", flush=True)

    mark(f"{theme} compose")
    tap_until("id:compose", "id:compose-to", tries=2, timeout=8)
    shot(f"{theme}-compose")
    # Schedule send from the top bar's clock: the presets' sheet, then the snackbar with Undo.
    # The keyboard is up after the address, and its dismissal takes the first tap on the bar:
    # the sheet is asked for again instead of sent for once.
    tap("id:compose-to")
    adb("shell", "input", "text", "maya@northwind.dev")
    # The clock's sheet is the flakiest control in the app (an ActionSheet opened in the tap that
    # dismisses the keyboard): a tap that opens nothing is asked again, three times, and a sheet
    # that never opens costs its two screens instead of the run.
    if sheet("id:send-later", "Tomorrow morning"):
        shot(f"{theme}-schedule-menu")
        tap("Tomorrow morning")
        wait("id:toast-action", 15)
        save(f"{theme}-scheduled-snackbar", frame())
    else:
        skip("Schedule send's sheet")
    # Whatever the schedule left open (a sheet, the composer itself), the inbox comes back
    # before the next screen: a stray focus would take the keystrokes meant for search.
    if find("id:compose-page", 2) is not None:
        close_compose()
    if find("id:messages", 3) is None:
        back_to("id:messages")
    wait("id:messages")

    mark(f"{theme} inbox scrolled")
    # The inbox scrolled: rows under the glass bar at the top and the glass tab bar at the foot,
    # a frame taken while the finger is still dragging, and one once it settled.
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], f"{theme}-inbox-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot(f"{theme}-inbox-scrolled")
    # Deeper: the bar minimises to a pill around the chosen tab, the page showing either side of it.
    swipe(w // 2, h * 7 // 10, w // 2, h * 4 // 10, 400)
    shot(f"{theme}-inbox-tabmin")
    bar_geometry()
    scroll_up_to("id:message-.*")

    mark(f"{theme} search")
    tab("Search", "id:search")
    shot(f"{theme}-search")
    rest = bar_box()
    tap("id:search")  # the field, before anything is typed
    adb("shell", "input", "text", "roadmap")
    wait("id:result-count", 15)
    # The keyboard is up: the bar is either covered or where it was, never riding on the keyboard.
    typing = bar_box()
    if rest and typing and abs(typing[1] - rest[1]) > 6:
        raise Failure(f"the tab bar moved {typing[1] - rest[1]} px while the keyboard is up")
    print("the bar while typing:", "covered" if typing is None else f"top {typing[1]}", flush=True)
    shot(f"{theme}-search-typing")
    back()  # the keyboard
    shot(f"{theme}-search-results")
    # A mail laid out for 600px fits the phone's width.
    tap("id:search")
    adb("shell", "input", "keyevent", "123", *["67"] * 8)  # end, then delete "roadmap"
    adb("shell", "input", "text", "receipt")
    wait("Your receipt from Fastmail", 15)
    back()
    # The first tap may only take the focus from the search field.
    tap_until("Your receipt from Fastmail", "id:reader", tries=2, timeout=8)
    shot(f"{theme}-reader-fit")
    back()
    # A search that finds nothing says so, and clears back to the hint.
    tap("id:search")
    adb("shell", "input", "keyevent", "123", *["67"] * 10)
    adb("shell", "input", "text", "zzzzqqq")
    wait("id:search-empty", 15)
    back()
    shot(f"{theme}-search-none")

    mark(f"{theme} mailboxes")
    tab("Mailboxes", "id:mailboxes")
    shot(f"{theme}-mailboxes")
    tap("Scheduled")
    if find("id:scheduled", 10) is None:  # the list's own id; the shot is the proof either way
        skip("the Scheduled list (nothing was scheduled this run)")
    shot(f"{theme}-scheduled")
    # An empty folder on the phone: the one draft is deleted, and Drafts says so with its next
    # step. The tab, not Back: the Scheduled list is a folder of this tab, and Back from it can
    # leave the app.
    tab("Mailboxes", "id:mailboxes")
    tap_until("Drafts", "id:messages", tries=2, timeout=15)
    if row_settled():
        select_first_row()
        tap("id:picked-delete")
        wait("id:empty-compose", 10)
        shot(f"{theme}-empty-folder")
    tab("Mailboxes", "id:mailboxes")
    tap_until("All inboxes", "id:messages", tries=2, timeout=15)

    mark(f"{theme} notifications")
    # The notification inbox: the feed, a chip, a notification, its sources.
    tab("Notifications", "Search notifications")
    shot(f"{theme}-notifications")
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], f"{theme}-notifications-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot(f"{theme}-notifications-scrolled")
    # The menu's own testID is not in the accessibility tree, so the sheet is known by its first
    # action; nothing else on this page offers it.
    if sheet("id:notify-more", "Sources"):
        shot(f"{theme}-notifications-menu")
        tap("Sources")
        wait("id:sources", 10)
        shot(f"{theme}-sources")
        tap("id:sources-add-top")
        wait("id:add-source", 10)
        shot(f"{theme}-source-kinds")
        back_to("id:sources")
        back_to("id:notifications")
    else:
        skip("the notifications menu and its sources screens")
    # A notification opens on its own page; Back returns to the feed. The rows' titles are not
    # always their own nodes, so the first row is tapped where the list starts.
    adb("shell", "input", "tap", str(w // 2), str(h // 3))
    if find("id:notify-reader", 6) is not None:
        shot(f"{theme}-notification")
        back()
    find("Search notifications", 10)

    mark(f"{theme} settings")
    tab("Settings", "id:signed-in-as")
    shot(f"{theme}-settings")
    # The large title scrolls away under the bar; the rows continue under it.
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], f"{theme}-settings-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot(f"{theme}-settings-scrolled")
    # The bar minimised here, then another tab and back: the pill must be Settings' own icon at
    # Settings' slot (nsh-cupertino 0.4.1 reads the live selection).
    tab("Mail", "id:messages")
    tab("Settings", "id:settings")
    shot(f"{theme}-settings-pill")
    # The shots scrolled the list: the account row the next steps use is back at the top.
    scroll_up_to("id:account-more-0")

    mark(f"{theme} signature")
    # The first account's signature, then a new message that carries it.
    tap_until("id:account-more-0", "Signature…", tries=2, timeout=8)
    tap_until("Signature…", "id:signature-text", tries=1, timeout=8)
    tap("id:signature-text")
    adb("shell", "input", "text", "'**Lin%sChen**'")
    adb("shell", "input", "keyevent", "66")
    adb("shell", "input", "text", "'Northwind%s-%s[northwind.dev](https://northwind.dev)'")
    back()  # the keyboard
    wait("id:signature-preview")
    shot(f"{theme}-signature")
    tap_until("id:signature-save", "id:signed-in-as", tries=2, timeout=8)

    mark(f"{theme} api keys")
    # The notification settings: the keys agents read the feed with, and the rules.
    if scroll_to("API keys"):
        tap("API keys")
        wait("id:api-keys", 10)
        shot(f"{theme}-api-keys")
        tap("id:keys-add-top")
        wait("New API key", 10)
        shot(f"{theme}-new-key")
        back_to("id:api-keys")

    mark(f"{theme} notification rules")
    if scroll_to("Per source and priority"):
        tap("Per source and priority")
        wait("id:notify-rules", 10)
        shot(f"{theme}-notify-rules")
        back_to("Per source and priority")
    # The end of the list: the last row must clear the tab bar, not go under it.
    settings_bottom(f"{theme}-settings-bottom")

    mark(f"{theme} compose with signature")
    tab("Mail", "id:messages")
    shot(f"{theme}-tab-back-to-mail")
    tap_until("id:compose", "id:compose-to", tries=2, timeout=8)
    shot(f"{theme}-compose-signature")
    back()  # the keyboard, when the field took the focus
    close_compose()
    wait("id:messages")

    mark(f"{theme} theme swap")
    # The appearance changes while the app runs: a colour change, so this waits on the pixels.
    other = "light" if theme == "dark" else "dark"
    before = frame()
    adb("shell", "cmd", "uimode", "night", "yes" if other == "dark" else "no")
    save(f"{theme}-then-{other}-live", steady(before))
    adb("shell", "cmd", "uimode", "night", "yes" if theme == "dark" else "no")
    steady()  # this theme's appearance again, before the screen is touched

    mark(f"{theme} sign out")
    # Signing out shows the onboarding.
    sign_out(f"{theme}-sign-out-dialog")
    # The first screen of the onboarding, painted: where mail comes from, and its way on.
    wait("id:mode-local", 10)
    wait("id:onboarding-go", 10)
    shot(f"{theme}-onboarding")
    # The cloud form: the server address and the sign-in/sign-up choice are painted before
    # anything is typed into it.
    tap("id:mode-cloud")
    wait("id:server", 10)
    wait("id:cloud-email", 10)
    wait("Create account", 10)
    shot(f"{theme}-onboarding-cloud")


def dark_walk():
    """The dark pass: the shells, the reading, the writing, the glass and the onboarding — the
    surfaces where dark is a design of its own, not every functional sub-flow the light walk has
    already been through (that walk is what costs the minutes, and dark changes no layout). Its
    frames are what the contrast, the glass and the floating bar are read from."""
    global mode
    mode, theme = "dark", "dark"
    adb("shell", "cmd", "uimode", "night", "yes")

    mark("dark inbox")
    launch()
    shot("dark-inbox")
    bar_geometry()
    loading_shot("dark-refreshing", "id:refresh")

    mark("dark reader")
    tap_until("id:message-.*", "id:reader", tries=2, timeout=8)
    shot("dark-reader")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 400)
    shot("dark-reader-scrolled")
    back_to("id:messages")

    mark("dark compose")
    tap_until("id:compose", "id:compose-to", tries=2, timeout=8)
    shot("dark-compose")
    tap("id:compose-to")
    adb("shell", "input", "text", "maya@northwind.dev")
    if sheet("id:send-later", "Tomorrow morning"):
        shot("dark-schedule-menu")
        tap("Tomorrow morning")
        wait("id:toast-action", 15)
        save("dark-scheduled-snackbar", frame())
    else:
        skip("Schedule send's sheet (dark)")
    if find("id:compose-page", 2) is not None:
        close_compose()
    if find("id:messages", 3) is None:
        back_to("id:messages")

    mark("dark inbox scrolled")
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], "dark-inbox-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot("dark-inbox-scrolled")
    swipe(w // 2, h * 7 // 10, w // 2, h * 4 // 10, 400)
    shot("dark-inbox-tabmin")
    bar_geometry()
    scroll_up_to("id:message-.*")

    mark("dark search")
    tab("Search", "id:search")
    shot("dark-search")
    tap("id:search")
    adb("shell", "input", "text", "roadmap")
    wait("id:result-count", 15)
    back()  # the keyboard
    shot("dark-search-results")

    mark("dark notifications")
    tab("Notifications", "Search notifications")
    shot("dark-notifications")
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], "dark-notifications-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot("dark-notifications-scrolled")

    mark("dark settings")
    tab("Settings", "id:signed-in-as")
    shot("dark-settings")
    during(["swipe", str(w // 2), str(h * 8 // 10), str(w // 2), str(h * 5 // 10), "1200"], "dark-settings-mid-scroll")
    swipe(w // 2, h * 7 // 10, w // 2, h * 3 // 10, 300)
    shot("dark-settings-scrolled")
    # The minimised bar around the chosen tab, which the frame check reads from the dark frames.
    tab("Mail", "id:messages")
    tab("Settings", "id:settings")
    shot("dark-settings-pill")

    mark("dark theme swap")
    before = frame()
    adb("shell", "cmd", "uimode", "night", "no")
    save("dark-then-light-live", steady(before))
    adb("shell", "cmd", "uimode", "night", "yes")
    steady()

    mark("dark sign out")
    sign_out("dark-sign-out-dialog")
    wait("id:mode-local", 10)
    wait("id:onboarding-go", 10)
    shot("dark-onboarding")
    tap("id:mode-cloud")
    wait("id:server", 10)
    wait("id:cloud-email", 10)
    wait("Create account", 10)
    shot("dark-onboarding-cloud")


def large_and_tablet():
    global mode
    mode = "large"
    mark("large text")
    # Larger text (Android's font size at 130%), then a tablet-sized screen (1280 x 800 dp).
    adb("shell", "settings", "put", "system", "font_scale", "1.3")
    launch()
    shot("large-text-inbox")
    tap_until("id:message-.*", "id:reader", tries=2, timeout=8)
    shot("large-text-reader")

    mark("tablet")
    adb("shell", "settings", "put", "system", "font_scale", "1.0")
    adb("shell", "wm", "size", "2560x1600")
    adb("shell", "wm", "density", "320")
    launch()
    tap_until("id:message-.*", "id:reader", tries=2, timeout=8)
    shot("tablet")
    adb("shell", "wm", "size", "1440x3120")
    adb("shell", "wm", "density", "480")


def main():
    global BEGIN, DENSITY, w, h, mode, out
    apk_dir = sys.argv[1]
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    try:
        mark("boot")
        booted()
        BEGIN = time.time()
        # A phone's own screen: 1440 x 3120 at density 3.0 (the profile's is 1080 x 2400 at 2.625),
        # as the phones this ships to draw it.
        adb("shell", "wm", "size", "1440x3120")
        adb("shell", "wm", "density", "480")
        print("screen", adb("shell", "wm", "size").strip(), adb("shell", "wm", "density").strip(), flush=True)
        mark("install")
        apk = sorted(glob.glob(os.path.join(apk_dir, "*.apk")))[0]
        adb("install", "-r", "-g", apk)
        adb("shell", "settings", "put", "system", "font_scale", "1.0")
        # The idle launcher behind the app sometimes stops responding on a loaded runner, and its
        # dialog then covers the app every few seconds: take the launcher out and hide such dialogs.
        adb("shell", "settings", "put", "global", "hide_error_dialogs", "1")
        adb("shell", "pm", "disable-user", "--user", "0", "com.google.android.apps.nexuslauncher", check=False)
        w, h = map(int, adb("shell", "wm", "size").split()[-1].split("x"))
        DENSITY = (float(adb("shell", "getprop", "ro.sf.lcd_density", check=False).strip() or 0) or 480.0) / 160
        drive()
    except Exception as e:
        if not isinstance(e, Failure):
            traceback.print_exception(type(e), e, e.__traceback__)
        failures.append(f"[{STEP}] {e}")
        print("FAILED-STEP:", STEP, flush=True)
        print("FAIL", e, flush=True)
        evidence(f"{mode}-fail-{len(failures)}")
    steps.append((STEP, time.time() - STEP_AT))
    with open(os.path.join(out, "logcat.txt"), "w") as f:
        f.write(raw("logcat", "-d")[-400000:])
    with open(os.path.join(out, "steps.txt"), "w") as f:
        for name, seconds in steps:
            f.write(f"{seconds:6.1f} s  {name}\n")
        f.write(f"{time.time() - START:6.1f} s  boot, install and the drive ({DRIVE_BUDGET:.0f} s of drive)\n")
    if failures:
        with open(os.path.join(out, "failures.txt"), "w") as f:
            f.write("\n".join(failures) + "\n")
        print("\n".join(failures))
        sys.exit(1)
    print(f"the drive took {time.time() - BEGIN:.0f} s, the job step {time.time() - START:.0f} s")


if __name__ == "__main__":
    main()
