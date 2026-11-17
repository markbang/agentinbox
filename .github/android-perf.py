#!/usr/bin/env python3
"""Measures scrolling on the emulator: frame times from `gfxinfo` while the inbox of the large demo
mailbox (`--cfg nshmail_demo_large`: 10,000 messages, 2,000 conversations) is flung down.

Usage: android-perf.py <dir with the APK> [swipes]

Prints one line per run with the frames drawn, their p50/p90/p99 and the share of janky ones (over
16.7 ms), plus the widest frame, which is where a sync or a page stall shows.

Nothing here sleeps to let the app catch up: the inbox is waited for by polling its dump, the quiet
screen before the measurement by two identical frames, and the end of the flings by a frame count
that stopped growing.
"""
import os
import re
import statistics
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PKG = "top.bangwu.nshmail"
POLL = 0.25
apk_dir, swipes = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 24
apk = os.path.join(apk_dir, "AgentInbox.apk")


def adb(*args, check=True):
    return subprocess.run(["adb", *args], check=check, capture_output=True, encoding="utf-8", errors="replace").stdout


def frame():
    return subprocess.run(["adb", "exec-out", "screencap", "-p"], check=False, capture_output=True).stdout


def poll(probe, timeout):
    """`probe()`'s value as soon as it is truthy, else None at the deadline."""
    end = time.time() + timeout
    while True:
        found = probe()
        if found:
            return found
        if time.time() >= end:
            return None
        time.sleep(POLL)


def booted(timeout=240):
    """Boot is done for the user, not just the kernel."""
    adb("wait-for-device")

    def ready():
        done = adb("shell", "getprop sys.boot_completed; getprop sys.user.0.ce_available", check=False).split()
        return done[:1] == ["1"] and done[1:2] == ["true"]

    if poll(ready, timeout) is None:
        raise SystemExit(f"the emulator did not finish booting in {timeout} s")
    # Right after boot the system compiles and indexes: wait (bounded) for the load to drop.
    cpus = adb("shell", "nproc", check=False).strip()
    cpus = int(cpus) if cpus.isdigit() else 2

    def light():
        try:
            return float(adb("shell", "cat", "/proc/loadavg", check=False).split()[0]) < cpus * 1.5
        except (IndexError, ValueError):
            return True

    poll(light, 60)


def frames():
    """The frame intervals gfxinfo recorded since the last reset, in ms (one per frame drawn)."""
    out = adb("shell", "dumpsys", "gfxinfo", PKG, "framestats", check=False)
    head = out.split("---PROFILEDATA---")[1] if "---PROFILEDATA---" in out else ""
    rows = [line.split(",") for line in head.splitlines() if line.count(",") > 10]
    if not rows:
        return []
    columns = {name: at for at, name in enumerate(rows[0])}
    done, started = columns.get("FrameCompleted"), columns.get("IntendedVsync")
    if done is None or started is None:
        return []
    times = []
    for row in rows[1:]:
        try:
            times.append((int(row[done]) - int(row[started])) / 1e6)
        except (IndexError, ValueError):
            continue
    return [t for t in times if t > 0]


def summary(label, times):
    if not times:
        print(f"{label}: no frames recorded", flush=True)
        return
    times = sorted(times)
    at = lambda q: times[min(len(times) - 1, int(q * len(times)))]
    jank = sum(1 for t in times if t > 16.7) / len(times) * 100
    print(
        f"{label}: {len(times)} frames, p50 {statistics.median(times):.1f} ms, "
        f"p90 {at(0.9):.1f}, p99 {at(0.99):.1f}, max {times[-1]:.1f}, over 16.7 ms {jank:.0f}%",
        flush=True,
    )


def listed():
    """The inbox's rows, from the accessibility dump."""
    xml = adb("exec-out", "rm -f /sdcard/ui.xml; uiautomator dump --compressed /sdcard/ui.xml >/dev/null 2>&1; cat /sdcard/ui.xml", check=False)
    if not xml.strip().startswith("<?xml"):
        return False
    try:
        return any(re.fullmatch(r"message-.*", n.get("resource-id", "")) for n in ET.fromstring(xml).iter("node"))
    except ET.ParseError:
        return False


def diagnose():
    """Why no rows: what the app logged, and what is on screen."""
    for line in adb("logcat", "-d", "-t", "400", check=False).splitlines():
        if re.search(r"FATAL|AndroidRuntime|Exception|nsh|NSH|panic", line):
            print("logcat:", line[:300], flush=True)
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
    print(adb("exec-out", "cat", "/sdcard/ui.xml", check=False)[:4000], flush=True)


def quiet(timeout=10):
    """Until two screenshots in a row are the same: the app stopped drawing, so the measurement
    starts from a still screen."""
    end, last = time.time() + timeout, None
    while time.time() < end:
        now = frame()
        if now and now == last:
            return
        last = now
        time.sleep(POLL)
    print("the screen never settled, measuring anyway", flush=True)


booted()
adb("install", "-r", apk)
adb("shell", "am", "force-stop", PKG)
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
if poll(listed, 120) is None:
    print("the inbox did not show its rows: nothing measured", flush=True)
    diagnose()
    sys.exit(1)
quiet()

width, height = 1080, 2400
size = re.findall(r"\d+", adb("shell", "wm", "size", check=False))
if len(size) >= 2:
    width, height = int(size[0]), int(size[1])
x, top, bottom = width // 2, int(height * 0.30), int(height * 0.80)

adb("shell", "dumpsys", "gfxinfo", PKG, "reset", check=False)
# The flings are one gesture stream: each `input swipe` lasts 250 ms and the next starts as it ends.
for _ in range(swipes):
    adb("shell", "input", "swipe", str(x), str(bottom), str(x), str(top), "250")
# Until two frame lists in a row are the same: the list came to rest and drew nothing more.
end, last = time.time() + 10, None
while time.time() < end:
    now = frames()
    if now and now == last:
        break
    last = now
    time.sleep(POLL)
summary(f"scroll, {swipes} flings", frames())
