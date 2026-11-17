#!/usr/bin/env bash
# The drive, run inside the emulator session (the emulator is already up when this starts): the frame
# measurement, then the screenshots in light and dark, then the frame check on what they drew.
#
# It is a file and not the workflow's `script:` because that action runs the script one line at a
# time: a function or an `if` spread over lines cannot work there.
#
# A failed drive is retried once after a fresh APK install, with the time the step has left, and the
# run is marked flaky when the retry passes. Usage: android-ui-run.sh [perf_only]
set -uo pipefail

perf_only=${1:-false}
began=$(date +%s)

python3 .github/android-perf.py app/.nsh/perf || echo "::warning title=Android frames::the frame measurement failed; the screens still ran"
if [ "$perf_only" = "true" ]; then
  exit 0
fi

# The whole drive cannot outlast its budget, and the budget cannot outlast the step.
drive() {
  DRIVE_BUDGET="$1" timeout -k 20 "$(( $1 + 30 ))" python3 .github/android-ui.py app/.nsh/ui screens
}
glass() {
  node tools/glass-check.mjs screens || {
    echo "::error title=Android frames::the floating layer did not pass its frame check"
    return 1
  }
}

if drive 660; then
  glass || exit 1
  echo "the drive passed on its first attempt" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

# 14 minutes for the step, 60 s kept for the emulator to go down cleanly.
left=$(( 840 - ($(date +%s) - began) ))
if [ "$left" -lt 300 ]; then
  echo "::error title=Android UI::the drive failed with $left s of the step left: no retry"
  exit 1
fi
echo "::warning title=Android UI is flaky::the drive failed; reinstalling the APK and retrying once"
mv screens screens-attempt-1 || true
mkdir -p screens
# The demo mailbox keeps what the first attempt did to it (a draft deleted, a signature saved):
# the retry starts from the app's own first state.
adb shell pm clear top.bangwu.nshmail
adb install -r -g app/.nsh/ui/AgentInbox.apk
adb shell am force-stop top.bangwu.nshmail
if drive "$left"; then
  glass || exit 1
  echo "**flaky**: the drive failed on its first attempt and passed on the retry (\`screens-attempt-1/\`)." >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  echo "::warning title=Android UI is flaky::the drive passed on the retry"
  exit 0
fi
echo "::error title=Android UI::the drive failed on both attempts"
exit 1
