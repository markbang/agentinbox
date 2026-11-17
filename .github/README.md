English | [简体中文](README.zh-CN.md)

# CI workflows

| Workflow | What it proves | When it runs |
|---|---|---|
| `app.yml` | The app builds for Web, Linux, Windows and Android, is tested, and a release is packaged | Every push and pull request |
| `core.yml` | The mail crates | Every push and pull request |
| `server.yml` | The cloud server image | Every push and pull request |
| `android-ui.yml` | AgentInbox on an Android emulator, light and dark: `.github/android-ui.py` drives every screen and keeps its screenshots; `.github/android-perf.py` measures the large mailbox's frames | Every push to `main` and every `v*` tag; on a pull request only with the `android-ui` label |
| `ci-flaky.yml` | One issue per Android UI screen that keeps failing | After every Android UI run, and daily |
| `screenshots.yml` | The web app's screens | Every push and pull request |

## Android UI

It is the slow one (an emulator, an APK and ~90 screenshots), so it runs where its evidence is
wanted and not on every push:

- **On a pull request** only when the PR carries the `android-ui` label, and then again on each
  push to that PR (`opened`, `labeled`, `synchronize`, `reopened`; the job's `if` reads the labels).
  Add any other label and nothing starts.
- **Always** on a push to `main` that touches `app/**` or the driver, and on a `v*` tag.
- One emulator per event: the frame measurement and the screenshots run in the same emulator
  session, and the screenshot job is the only place an emulator starts.

Budgets, so a stuck run cannot burn an hour:

| Where | Bound |
|---|---|
| The job | 20 minutes |
| The emulator step (boot, frames, screens) | 15 minutes |
| One screen in the driver | 2 minutes |
| The whole drive | 9 minutes after boot (`DRIVE_BUDGET`) |
| The frame measurement | its own waits, 4 minutes at most |

The drive stops at its **first** failure instead of carrying on into a broken app. It then prints
`FAILED-STEP: <screen>`, and leaves beside the screens:

- `<theme>-fail-<n>.png` — the screen the step was on,
- `<theme>-fail-<n>.xml` — its accessibility dump,
- `failure-logcat.txt` — `logcat` since that step began,
- `failures.txt` and `steps.txt` — what failed, and how long each screen took.

All of it is in the `android-ui` artifact, uploaded on failure as well as on success.

**Retry once.** A failed drive is retried once after reinstalling the APK, with the time the step has
left, without restarting the emulator (`.github/android-ui-run.sh`, which the step calls in one line
because that action runs its `script:` one line at a time). The first attempt's screenshots stay in
`screens-attempt-1/`. A retry that passes marks the run **flaky** in its summary and as a warning
annotation, so a flaky screen stays visible instead of looking green.

**APKs are cached** by the hash of the app's sources, so a run that only changes the driver or a
document does not rebuild the app. Only the exact key is restored: an APK from other sources would
screenshot the wrong app.

## Flaky screens

`ci-flaky.yml` reads the last 40 Android UI runs. A screen that failed **2 runs in a row on `main`**,
or **3 in a row on one branch**, opens — or updates — one issue titled
`CI: Android UI <screen> is flaky`, labelled `ci` and `flaky`, with the run links and the failure
log. A repeat is a comment on that issue, never a second issue; a closed one is reopened.

## Running the Android UI by hand

```bash
gh workflow run android-ui.yml --ref main            # on main: the full drive and the publish step
gh workflow run android-ui.yml --ref main -f perf_only=true   # frames only
gh pr edit <n> --add-label android-ui                # on a pull request
```
