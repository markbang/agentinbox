#!/usr/bin/env python3
"""The app's theme is the design system's, plus issue #3's three overrides.

nsh-cupertino ships the values; AgentInbox's contrast gate cannot pass three of
Apple's light-appearance roles (system-blue, system-red, the secondary label's
alpha), so app/theme.json changes exactly those and nothing else. This keeps the
copy honest as the library's values move.

Usage: scripts/theme-check.py            (exit 1 when the app's theme drifts)
"""
import json, sys
from pathlib import Path

root = Path(__file__).parent.parent
library = json.loads((root / "vendor/nsh-cupertino/theme/theme.json").read_text())["cssVars"]
app = json.loads((root / "app/theme.json").read_text())["cssVars"]

# Issue #3: the three roles, as the recorded decision overrides them.
OVERRIDES = {"light": {"system-blue": "#0062d6ff", "system-red": "#d70015ff", "secondary-label": "#3c3c43b8"}}

drift = []
for mode in ("theme", "light", "dark"):
    expected = {**library.get(mode, {})}
    expected.update(OVERRIDES.get(mode, {}))
    actual = app.get(mode, {})
    for key in sorted(set(expected) | set(actual)):
        if expected.get(key) != actual.get(key):
            drift.append(f"{mode}.{key}: the library has {expected.get(key)}, the app {actual.get(key)}")

if drift:
    print("\n".join(drift))
    sys.exit(1)
print(f"ok  app/theme.json is the library's, with {sum(len(v) for v in OVERRIDES.values())} contrast overrides")
