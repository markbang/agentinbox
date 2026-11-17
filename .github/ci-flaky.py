#!/usr/bin/env python3
"""Turns repeated failures of one Android UI step into one issue per step, with the runs and the
failure log, so a flake is visible instead of being re-run away.

Reads the last RUNS runs of .github/workflows/android-ui.yml: a step that failed 3 runs in a row on
one branch, or 2 in a row on main, gets (or updates) the issue `CI: Android UI <step> is flaky`,
labelled `ci` and `flaky`. Never a second open issue with the same title, and a closed one is
reopened rather than duplicated.

Usage: ci-flaky.py [--dry-run]   (needs GH_TOKEN, and GITHUB_REPOSITORY or --repo owner/name)
"""
import json
import os
import re
import subprocess
import sys

RUNS = int(os.environ.get("CI_FLAKY_RUNS", "40"))
WORKFLOW = "android-ui.yml"
THRESHOLD = {"main": 2}
DEFAULT_THRESHOLD = 3
DRY = "--dry-run" in sys.argv
REPO = os.environ.get("GITHUB_REPOSITORY") or "markbang/agentinbox"


def gh(*args, parse=True):
    done = subprocess.run(["gh", *args], capture_output=True, encoding="utf-8", errors="replace", timeout=120)
    if done.returncode != 0:
        print(f"gh {' '.join(args[:3])} failed: {done.stderr.strip()[:400]}", flush=True)
        return None
    return json.loads(done.stdout) if parse else done.stdout


def runs():
    out = gh("api", f"/repos/{REPO}/actions/workflows/{WORKFLOW}/runs?per_page={RUNS}", parse=False)
    return json.loads(out)["workflow_runs"] if out else []


def failed_step(run):
    """The step the driver stopped in, from its own marker; the workflow step if it never got there."""
    log = gh("run", "view", str(run["id"]), "--repo", REPO, "--log-failed", parse=False) or ""
    steps = re.findall(r"FAILED-STEP: (.+?)\s*$", log, re.M)
    if steps:
        return steps[0].strip(), excerpt(log)
    jobs = gh("api", f"/repos/{REPO}/actions/runs/{run['id']}/jobs") or {}
    for job in jobs.get("jobs", []):
        for step in job.get("steps", []):
            if step.get("conclusion") == "failure":
                return step["name"], excerpt(log)
    return "the emulator job", excerpt(log)


def excerpt(log):
    """The failure lines and what surrounds them, without the log parser's `emulator UNKNOWN STEP
    <time>` prefixes: enough to know what broke, not the whole transcript."""
    lines = [re.sub(r"^.*?\tUNKNOWN STEP\t\d{4}-\d\d-\d\dT[\d:.]+Z ?", "", line).rstrip() for line in log.splitlines()]
    hot = [at for at, line in enumerate(lines) if re.search(r"FAIL |FAILED-STEP|##\[error\]|Traceback|Exception", line)]
    around = sorted({near for at in hot for near in range(max(0, at - 3), min(len(lines), at + 3))})
    lines = [lines[at] for at in around] if around else [line for line in lines if line.strip()]
    return "\n".join(lines)[-4000:]


def streaks():
    """(branch, step) -> the runs that failed it consecutively, newest first. Only a branch's current
    streak counts: one that a later run already ended (a fix, or a different step) is history."""
    found = {}
    seen = {}
    newest = {}
    for run in runs():
        branch = run["head_branch"] or "?"
        conclusion = run["conclusion"]
        if conclusion == "cancelled" or conclusion is None:
            continue
        newest.setdefault(branch, run["id"])
        if conclusion != "failure":
            seen[branch] = None  # a green run ends the streak
            continue
        step, log = failed_step(run)
        current = seen.get(branch)
        if current and current["step"] != step:
            current = None
        current = current or {"step": step, "runs": [], "log": log}
        current["runs"].append(run)
        seen[branch] = current
        found[(branch, step)] = current
    return {key: streak for key, streak in found.items() if streak["runs"][0]["id"] == newest.get(key[0])}


def title(step):
    return f"CI: Android UI {step} is flaky"


def open_issues():
    out = gh("issue", "list", "--repo", REPO, "--state", "all", "--label", "flaky", "--limit", "100", "--json", "number,title,state") or []
    return {issue["title"]: issue for issue in out}


def body(branch, streak):
    links = "\n".join(f"- [{r['head_branch']} {r['created_at'][:16]}]({r['html_url']})" for r in streak["runs"])
    return (
        f"The Android UI workflow failed in **{streak['step']}** on `{branch}`, "
        f"{len(streak['runs'])} runs in a row. The driver stops at its first failure and leaves the "
        f"screenshot, the dump and the logcat in that run's `android-ui` artifact.\n\n"
        f"{links}\n\n<details><summary>the last failure's log</summary>\n\n```\n{streak['log']}\n```\n</details>\n"
    )


def report(step, branch, streak, issue, action):
    print(f"{action}: {title(step)} (branch {branch}, {len(streak['runs'])} runs", flush=True)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"- {title(step)}: {action.lower()} for `{branch}` after {len(streak['runs'])} runs in a row (#{issue})\n")


def main():
    issues = open_issues()
    for (branch, step), streak in streaks().items():
        need = THRESHOLD.get(branch, DEFAULT_THRESHOLD)
        if len(streak["runs"]) < need:
            continue
        newest = streak["runs"][0]
        issue = issues.get(title(step))
        if issue is None:
            print(f"opening {title(step)} for {branch}", flush=True)
            if DRY:
                continue
            out = gh(
                "api",
                "-X", "POST", f"/repos/{REPO}/issues",
                "-f", f"title={title(step)}",
                "-f", f"body={body(branch, streak)}",
                "-f", "labels[]=ci",
                "-f", "labels[]=flaky",
            )
            if out:
                report(step, branch, streak, out["number"], "opened")
            continue
        # The issue is there: add this run unless it already lists it, and reopen a closed one.
        number = issue["number"]
        if DRY:
            print(f"would update #{number}: {title(step)}", flush=True)
            continue
        comments = gh("api", f"/repos/{REPO}/issues/{number}/comments?per_page=100") or []
        listed = newest["html_url"] in json.dumps(comments) or newest["html_url"] in (gh("api", f"/repos/{REPO}/issues/{number}") or {}).get("body", "")
        if not listed:
            gh("api", "-X", "POST", f"/repos/{REPO}/issues/{number}/comments", "-f", f"body={body(branch, streak)}")
        if issue["state"] == "closed":
            gh("api", "-X", "PATCH", f"/repos/{REPO}/issues/{number}", "-f", "state=open")
        report(step, branch, streak, number, "updated")


if __name__ == "__main__":
    main()
