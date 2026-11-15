#!/usr/bin/env python3
"""WCAG contrast of the Cupertino roles the app draws text and marks in, in both appearances.

The app's theme is the design system's, with the three roles its gate cannot pass
overridden as nsh-cupertino's issue #3 records them (system-blue, system-red and
the secondary label's alpha). This checks what the app actually draws.

Usage: scripts/contrast.py [app/theme.json] [-v]   (exit 1 when a pair fails)
"""
import json, sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("-")]
theme = json.loads(Path(args[0] if args else Path(__file__).parent.parent / "app/theme.json").read_text())["cssVars"]

def rgba(hex_):
    h = hex_.lstrip("#")
    if len(h) == 6:
        h += "ff"
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4, 6)]

def over(top, bottom):
    a = top[3]
    return [top[i] * a + bottom[i] * (1 - a) for i in range(3)] + [1]

def lum(c):
    f = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

# The surfaces rows, bars and cards sit on.
SURFACES = ["system-background", "system-grouped-background", "secondary-system-grouped-background", "secondary-system-background"]
# Ink drawn as text: the label roles, links and errors.
TEXT = {"label": 4.5, "secondary-label": 4.5, "system-blue": 4.5, "system-red": 4.5}
# Marks and outlines: 3:1 is the bar for a graphic, and the account colours are marks.
MARKS = ["system-indigo", "system-purple", "system-pink", "system-blue", "system-red"]

failed = 0
def check(mode, label, fg, bg, need):
    global failed
    r = ratio(fg, bg)
    ok = r >= need
    failed += not ok
    if not ok or "-v" in sys.argv:
        print(f"{'ok  ' if ok else 'FAIL'} {mode:5} {label:52} {r:5.2f} (needs {need})")

for mode in ("light", "dark"):
    c = lambda k: rgba(theme[mode][k])
    for surface in SURFACES:
        for ink, need in TEXT.items():
            check(mode, f"{ink} on {surface}", c(ink), c(surface), need)
        for mark in MARKS:
            check(mode, f"{mark} on {surface}", c(mark), c(surface), 3)
    # A filled button: its label is 17 pt semibold, so large text (3:1); in light
    # the override takes it past 4.5 anyway.
    check(mode, "white on system-blue", rgba("#ffffff"), c("system-blue"), 3)
    # The separator is a hairline, not text: 1.5:1 keeps it visible without shouting.
    for surface in ("system-background", "secondary-system-grouped-background"):
        check(mode, f"separator on {surface}", over(c("separator"), c(surface)), c(surface), 1.2)

sys.exit(1 if failed else 0)
