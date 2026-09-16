#!/usr/bin/env python3
"""Milestone provenance / handoff tool.

Git is the authoritative source of truth. This tool snapshots a milestone's
BASELINE_SHA, classifies pre-existing working-tree state as protected, records
a declared expected scope, and later compares the working tree against that
immutable baseline so unexpected or protected-but-modified changes surface as
HOLD items requiring explicit human acknowledgement.

Subcommands: baseline, verify, acknowledge. See `.milestones/README.md` for
the full design writeup and manifest schema.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SCHEMA_VERSION = 1
MTIME_LABEL_SUFFIX = " (SUPPORTING EVIDENCE -- NOT AUTHORITATIVE)"
TOOL_METADATA_DIR = ".milestones/"


def _is_tool_metadata(path: str) -> bool:
    """.milestones/ holds this tool's own bookkeeping, never milestone content.

    Manifests are written after BASELINE_SHA is captured, so without this
    exclusion every verify would perpetually HOLD on the tool's own file.
    """
    return path.startswith(TOOL_METADATA_DIR)


class ToolError(Exception):
    """A usage/integrity error distinct from a HOLD-bearing verify result."""


# --------------------------------------------------------------------------
# Git plumbing
# --------------------------------------------------------------------------

def run_git(args: list[str], cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise ToolError(f"git {' '.join(args)} failed: {stderr.strip()}")
    return result.stdout.decode("utf-8", errors="replace")


def find_repo_root(start: Path) -> Path:
    try:
        out = run_git(["rev-parse", "--show-toplevel"], cwd=start)
    except ToolError as exc:
        raise ToolError(f"Not inside a git repository: {exc}") from exc
    return Path(out.strip())


def current_head_sha(repo_root: Path) -> str:
    return run_git(["rev-parse", "HEAD"], cwd=repo_root).strip()


def current_branch(repo_root: Path) -> str:
    return run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=repo_root).strip()


def sha_exists(repo_root: Path, sha: str) -> bool:
    result = subprocess.run(
        ["git", "cat-file", "-e", f"{sha}^{{commit}}"],
        cwd=str(repo_root),
        capture_output=True,
    )
    return result.returncode == 0


def parse_porcelain_v1_z(output: str) -> list[tuple[str, str, Optional[str]]]:
    """Parse `git status --porcelain=v1 -z` output.

    Returns (xy_code, path, orig_path_or_None) tuples. orig_path is set for
    renames/copies (XY contains R or C).
    """
    tokens = output.split("\0")
    entries: list[tuple[str, str, Optional[str]]] = []
    i = 0
    while i < len(tokens):
        record = tokens[i]
        if not record:
            i += 1
            continue
        xy = record[:2]
        path = record[3:]
        if "R" in xy or "C" in xy:
            i += 1
            orig = tokens[i] if i < len(tokens) else ""
            entries.append((xy, path, orig))
        else:
            entries.append((xy, path, None))
        i += 1
    return entries


def git_status_all(repo_root: Path, scope: Optional[str]) -> list[tuple[str, str, Optional[str]]]:
    args = ["status", "--porcelain=v1", "--untracked-files=all", "-z"]
    if scope:
        args += ["--", scope]
    out = run_git(args, cwd=repo_root)
    return parse_porcelain_v1_z(out)


def parse_name_status_z(output: str) -> list[tuple[str, str, Optional[str]]]:
    """Parse `git diff --name-status -M -z <sha>` output.

    Returns (status_letter, path, orig_path_or_None) tuples.
    """
    tokens = output.split("\0")
    entries: list[tuple[str, str, Optional[str]]] = []
    i = 0
    while i < len(tokens):
        status = tokens[i]
        if not status:
            i += 1
            continue
        letter = status[0]
        if letter in ("R", "C"):
            old = tokens[i + 1]
            new = tokens[i + 2]
            entries.append((letter, new, old))
            i += 3
        else:
            path = tokens[i + 1]
            entries.append((letter, path, None))
            i += 2
    return entries


def git_diff_name_status(repo_root: Path, baseline_sha: str, scope: Optional[str]) -> list[tuple[str, str, Optional[str]]]:
    args = ["diff", "--name-status", "-M", "-z", baseline_sha]
    if scope:
        args += ["--", scope]
    out = run_git(args, cwd=repo_root)
    return parse_name_status_z(out)


def is_binary_diff(repo_root: Path, ref: str, path: str) -> bool:
    out = run_git(["diff", "--numstat", ref, "--", path], cwd=repo_root)
    line = out.strip()
    if not line:
        return False
    parts = line.split("\t")
    return len(parts) >= 2 and parts[0] == "-" and parts[1] == "-"


def diff_patch_text(repo_root: Path, ref: str, path: str) -> str:
    return run_git(["diff", ref, "--", path], cwd=repo_root)


# --------------------------------------------------------------------------
# Hashing helpers
# --------------------------------------------------------------------------

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def sha256_file(path: Path) -> Optional[str]:
    if not path.is_file():
        return None
    return sha256_bytes(path.read_bytes())


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def mtime_evidence(path: Path) -> Optional[str]:
    if not path.exists():
        return None
    ts = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ") + MTIME_LABEL_SUFFIX


# --------------------------------------------------------------------------
# Manifest model
# --------------------------------------------------------------------------

IMMUTABLE_KEYS = ("baseline", "scope", "protected_pre_existing", "expected_files")


def immutable_fields_hash(manifest: dict) -> str:
    payload = {k: manifest.get(k) for k in IMMUTABLE_KEYS}
    return sha256_text(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def milestones_dir(repo_root: Path) -> Path:
    return repo_root / ".milestones"


def manifest_path(repo_root: Path, milestone_id: str) -> Path:
    return milestones_dir(repo_root) / f"{milestone_id}-manifest.json"


def load_manifest(repo_root: Path, milestone_id: str) -> dict:
    path = manifest_path(repo_root, milestone_id)
    if not path.is_file():
        available = sorted(p.stem.replace("-manifest", "") for p in milestones_dir(repo_root).glob("*-manifest.json")) if milestones_dir(repo_root).is_dir() else []
        hint = f" Available manifests: {', '.join(available)}." if available else " No manifests exist yet."
        raise ToolError(f"No manifest found for milestone '{milestone_id}' at {path}.{hint}")
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ToolError(f"Manifest for '{milestone_id}' is not valid JSON: {exc}") from exc

    required = ("milestone_id", "schema_version", "baseline", "protected_pre_existing", "expected_files", "acknowledgements", "immutable_fields_sha256")
    missing = [k for k in required if k not in manifest]
    if missing:
        raise ToolError(f"Manifest for '{milestone_id}' is malformed: missing key(s) {missing}")
    baseline = manifest["baseline"]
    for k in ("sha", "branch", "timestamp"):
        if k not in baseline:
            raise ToolError(f"Manifest for '{milestone_id}' is malformed: missing baseline.{k}")

    recomputed = immutable_fields_hash(manifest)
    if recomputed != manifest["immutable_fields_sha256"]:
        raise ToolError(
            f"Manifest for '{milestone_id}' failed an integrity check: its immutable "
            f"fields (baseline, scope, protected_pre_existing, expected_files) do not "
            f"match the recorded immutable_fields_sha256. Refusing to proceed rather "
            f"than trust a possibly-tampered manifest. Re-create the milestone under a "
            f"new milestone_id if this was intentional."
        )
    return manifest


def save_manifest(repo_root: Path, milestone_id: str, manifest: dict) -> None:
    milestones_dir(repo_root).mkdir(parents=True, exist_ok=True)
    path = manifest_path(repo_root, milestone_id)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def flatten_expected(expected_files: dict) -> dict[str, str]:
    flat: dict[str, str] = {}
    for category, paths in expected_files.items():
        for p in paths:
            flat[p] = category
    return flat


# --------------------------------------------------------------------------
# baseline
# --------------------------------------------------------------------------

def cmd_baseline(args: argparse.Namespace) -> int:
    repo_root = find_repo_root(Path.cwd())
    milestone_id = args.milestone_id

    existing_path = manifest_path(repo_root, milestone_id)
    if existing_path.is_file():
        raise ToolError(
            f"Manifest for milestone '{milestone_id}' already exists at {existing_path}. "
            f"Baselines are immutable once created; this tool deliberately provides no "
            f"reset/recreate operation. Choose a different milestone_id, or delete the "
            f"file yourself outside this tool if you are certain it should be discarded."
        )

    scope = args.scope

    expected_files: dict[str, list[str]] = {}
    for item in args.expect or []:
        if ":" not in item:
            raise ToolError(f"--expect value '{item}' must be in CATEGORY:PATH form")
        category, path = item.split(":", 1)
        expected_files.setdefault(category, []).append(path)

    # Concurrency guard: refuse to baseline on a tree where another
    # milestone's declared expected scope is still dirty.
    if not args.force:
        conflicts = _detect_concurrency_conflicts(repo_root, milestone_id)
        if conflicts:
            lines = "\n".join(f"  - {other_id}: {path}" for other_id, path in conflicts)
            raise ToolError(
                "Refusing to create baseline: the working tree currently has changes "
                "that overlap another milestone's declared expected scope, suggesting "
                "that milestone's work is still in progress on this tree:\n"
                f"{lines}\n"
                "This tool is single-milestone-at-a-time per branch. Finish/commit that "
                "milestone's work first, or pass --force to override explicitly (the "
                "override will be recorded in this manifest's notes)."
            )

    baseline_sha = current_head_sha(repo_root)
    branch = current_branch(repo_root)
    timestamp = now_iso()

    protected = _capture_protected_pre_existing(repo_root, scope)

    manifest = {
        "milestone_id": milestone_id,
        "schema_version": SCHEMA_VERSION,
        "created_at": timestamp,
        "baseline": {
            "sha": baseline_sha,
            "branch": branch,
            "timestamp": timestamp,
        },
        "scope": scope,
        "protected_pre_existing": protected,
        "expected_files": expected_files,
        "acknowledgements": [],
        "notes": args.notes or "",
    }
    if args.force:
        manifest["notes"] = (manifest["notes"] + " " if manifest["notes"] else "") + (
            "NOTE: baseline created with --force, overriding a detected concurrency "
            "conflict with another milestone's expected scope."
        )
    manifest["immutable_fields_sha256"] = immutable_fields_hash(manifest)

    save_manifest(repo_root, milestone_id, manifest)

    print(f"Baseline recorded for milestone '{milestone_id}'")
    print(f"  baseline_sha : {baseline_sha}")
    print(f"  branch       : {branch}")
    print(f"  timestamp    : {timestamp}")
    print(f"  scope        : {scope or '(repo root)'}")
    print(f"  protected    : {len(protected)} pre-existing working-tree path(s) captured")
    total_expected = sum(len(v) for v in expected_files.values())
    print(f"  expected     : {total_expected} declared path(s) across {len(expected_files)} categor{'y' if len(expected_files) == 1 else 'ies'}")
    print(f"  manifest     : {manifest_path(repo_root, milestone_id)}")
    return 0


def _detect_concurrency_conflicts(repo_root: Path, milestone_id: str) -> list[tuple[str, str]]:
    mdir = milestones_dir(repo_root)
    if not mdir.is_dir():
        return []
    dirty_paths = {path for _xy, path, _orig in git_status_all(repo_root, scope=None) if not _is_tool_metadata(path)}
    conflicts: list[tuple[str, str]] = []
    for manifest_file in sorted(mdir.glob("*-manifest.json")):
        other_id = manifest_file.stem.replace("-manifest", "")
        if other_id == milestone_id:
            continue
        try:
            other = json.loads(manifest_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        other_expected = flatten_expected(other.get("expected_files", {}))
        for path in other_expected:
            if path in dirty_paths:
                conflicts.append((other_id, path))
    return conflicts


def _capture_protected_pre_existing(repo_root: Path, scope: Optional[str]) -> list[dict]:
    entries = git_status_all(repo_root, scope)
    protected: list[dict] = []
    for xy, path, orig in entries:
        if _is_tool_metadata(path):
            continue
        index_status, worktree_status = xy[0], xy[1]
        abs_path = repo_root / path

        if xy == "??":
            kind = "untracked"
            rename_from = None
        elif "R" in xy:
            kind = "tracked-renamed"
            rename_from = orig
        elif index_status == "D" or worktree_status == "D":
            kind = "tracked-deleted"
            rename_from = None
        elif index_status == "A":
            kind = "tracked-added"  # staged new file, no baseline blob
            rename_from = None
        else:
            kind = "tracked-modified"
            rename_from = None

        is_binary = False
        patch_sha256 = None
        if kind == "tracked-modified":
            is_binary = is_binary_diff(repo_root, "HEAD", path)
            if not is_binary:
                patch_sha256 = sha256_text(diff_patch_text(repo_root, "HEAD", path))

        content_sha256 = sha256_file(abs_path) if kind != "tracked-deleted" else None

        protected.append({
            "path": path,
            "rename_from": rename_from,
            "kind": kind,
            "git_status": xy,
            "is_binary": is_binary,
            "patch_sha256": patch_sha256,
            "content_sha256": content_sha256,
            "mtime": mtime_evidence(abs_path),
        })
    return protected


# --------------------------------------------------------------------------
# classification (shared by verify + acknowledge)
# --------------------------------------------------------------------------

def _in_scope(path: str, scope: Optional[str]) -> bool:
    if not scope:
        return True
    scope_norm = scope.rstrip("/")
    return path == scope_norm or path.startswith(scope_norm + "/")


def classify(repo_root: Path, manifest: dict) -> dict:
    scope = manifest["scope"]
    protected_by_path: dict[str, dict] = {}
    for entry in manifest["protected_pre_existing"]:
        protected_by_path[entry["path"]] = entry
        if entry.get("rename_from"):
            protected_by_path.setdefault(entry["rename_from"], entry)

    expected_flat = flatten_expected(manifest["expected_files"])

    baseline_sha = manifest["baseline"]["sha"]

    diff_entries = [e for e in git_diff_name_status(repo_root, baseline_sha, scope=None) if not _is_tool_metadata(e[1])]
    status_entries = [e for e in git_status_all(repo_root, scope=None) if not _is_tool_metadata(e[1])]

    rename_map: dict[str, str] = {}
    changed_paths: set[str] = set()
    for letter, path, orig in diff_entries:
        changed_paths.add(path)
        if letter == "R" and orig:
            rename_map[orig] = path
            changed_paths.add(orig)
    for _xy, path, orig in status_entries:
        changed_paths.add(path)
        if orig:
            changed_paths.add(orig)

    all_known_paths: set[str] = set(changed_paths) | set(protected_by_path.keys()) | set(expected_flat.keys())

    def resolve_current(path: str) -> str:
        seen = set()
        cur = path
        while cur in rename_map and cur not in seen:
            seen.add(cur)
            cur = rename_map[cur]
        return cur

    logical_paths: dict[str, str] = {}  # baseline-identity-path -> current-path
    for path in all_known_paths:
        resolved = resolve_current(path)
        origin = path
        if path in rename_map:
            origin = path  # keep the pre-rename identity as origin
        logical_paths[origin] = resolved

    # Also fold in reverse: if a path is itself a rename *target*, don't
    # double-list it under its own identity as well as under its origin.
    targets = set(rename_map.values())
    for origin in list(logical_paths.keys()):
        if origin in targets and origin not in rename_map:
            del logical_paths[origin]

    acks_by_path: dict[str, dict] = {}
    for ack in manifest.get("acknowledgements", []):
        acks_by_path[ack["path"]] = ack  # latest wins (list is append-only, iterate in order)

    result = {
        "expected": [],
        "expected_but_unchanged": [],
        "protected_unchanged": [],
        "hold_protected_modified": [],
        "hold_unexpected": [],
        "out_of_scope_changes": [],
    }

    acknowledged_hold_paths: set[str] = set()
    unresolved_hold_paths: set[str] = set()

    for origin, current_path in sorted(logical_paths.items()):
        report_path = current_path
        in_scope = _in_scope(report_path, scope) or _in_scope(origin, scope)

        is_expected = report_path in expected_flat or origin in expected_flat
        protected_entry = protected_by_path.get(origin) or protected_by_path.get(report_path)

        if not in_scope and not is_expected and protected_entry is None:
            result["out_of_scope_changes"].append(report_path)
            continue

        if is_expected:
            category = expected_flat.get(report_path) or expected_flat.get(origin)
            changed = report_path in changed_paths or origin in changed_paths
            if changed:
                result["expected"].append({
                    "path": report_path,
                    "category": category,
                    "renamed_from": origin if origin != report_path else None,
                })
            else:
                result["expected_but_unchanged"].append({"path": report_path, "category": category})
            continue

        if protected_entry is not None:
            abs_path = repo_root / report_path
            current_hash = sha256_file(abs_path)
            baseline_hash = protected_entry.get("content_sha256")
            unchanged = current_hash == baseline_hash
            item = {
                "path": report_path,
                "renamed_from": origin if origin != report_path else None,
                "kind": protected_entry.get("kind"),
            }
            if unchanged:
                result["protected_unchanged"].append(item)
            else:
                ack = acks_by_path.get(report_path) or acks_by_path.get(origin)
                is_ack_current = bool(ack and ack.get("hash_at_acknowledgement") == current_hash)
                item["acknowledged"] = is_ack_current
                item["acknowledgement"] = ack if is_ack_current else None
                result["hold_protected_modified"].append(item)
                if is_ack_current:
                    acknowledged_hold_paths.add(report_path)
                else:
                    unresolved_hold_paths.add(report_path)
            continue

        # Neither expected nor protected -> unexpected.
        abs_path = repo_root / report_path
        current_hash = sha256_file(abs_path)
        ack = acks_by_path.get(report_path) or acks_by_path.get(origin)
        is_ack_current = bool(ack and ack.get("hash_at_acknowledgement") == current_hash)
        item = {
            "path": report_path,
            "renamed_from": origin if origin != report_path else None,
            "acknowledged": is_ack_current,
            "acknowledgement": ack if is_ack_current else None,
        }
        result["hold_unexpected"].append(item)
        if is_ack_current:
            acknowledged_hold_paths.add(report_path)
        else:
            unresolved_hold_paths.add(report_path)

    result["unresolved_hold_count"] = len(unresolved_hold_paths)
    result["acknowledged_hold_count"] = len(acknowledged_hold_paths)
    return result


# --------------------------------------------------------------------------
# verify
# --------------------------------------------------------------------------

def cmd_verify(args: argparse.Namespace) -> int:
    repo_root = find_repo_root(Path.cwd())
    manifest = load_manifest(repo_root, args.milestone_id)

    baseline_sha = manifest["baseline"]["sha"]
    if not sha_exists(repo_root, baseline_sha):
        raise ToolError(
            f"Baseline commit {baseline_sha} for milestone '{args.milestone_id}' is no "
            f"longer reachable in this repository's history (rebase/history rewrite?). "
            f"Refusing to verify against an unresolvable baseline."
        )

    report = classify(repo_root, manifest)
    report["milestone_id"] = args.milestone_id
    report["baseline_sha"] = baseline_sha
    report["baseline_branch"] = manifest["baseline"]["branch"]
    report["scope"] = manifest["scope"]
    report["generated_at"] = now_iso()

    exit_code = 1 if report["unresolved_hold_count"] > 0 else 0
    report["exit_code"] = exit_code

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        _print_text_report(report)

    return exit_code


def _print_text_report(report: dict) -> None:
    mid = report["milestone_id"]
    print(f"Milestone {mid} -- verification against baseline {report['baseline_sha'][:12]} ({report['baseline_branch']})")
    print(f"Generated: {report['generated_at']}   Scope: {report['scope'] or '(repo root)'}")
    print()

    def section(title: str, items: list, fmt) -> None:
        print(f"{title} ({len(items)})")
        for item in items:
            print(f"  {fmt(item)}")
        print()

    section("EXPECTED", report["expected"], lambda i: f"[CHANGED] {i['path']}" + (f"  (renamed from {i['renamed_from']})" if i["renamed_from"] else ""))
    section("EXPECTED_BUT_UNCHANGED (warning -- declared scope shows no evidence of work)", report["expected_but_unchanged"], lambda i: i["path"])
    section("PROTECTED_UNCHANGED", report["protected_unchanged"], lambda i: i["path"] + (f"  (renamed from {i['renamed_from']})" if i["renamed_from"] else ""))

    def hold_fmt(i: dict) -> str:
        base = i["path"]
        if i.get("renamed_from"):
            base += f"  (renamed from {i['renamed_from']})"
        if i.get("acknowledged"):
            ack = i["acknowledgement"]
            base += f"\n    -> ACKNOWLEDGED by {ack['by']} at {ack['timestamp']}\n    reason: {ack['reason']}"
        return base

    section("HOLD: PROTECTED_MODIFIED", report["hold_protected_modified"], hold_fmt)
    section("HOLD: UNEXPECTED", report["hold_unexpected"], hold_fmt)

    if report["out_of_scope_changes"]:
        print(f"OUT OF SCOPE -- not evaluated by this milestone (informational only) ({len(report['out_of_scope_changes'])})")
        for p in report["out_of_scope_changes"]:
            print(f"  {p}")
        print()

    if report["unresolved_hold_count"] > 0:
        print(f"RESULT: {report['unresolved_hold_count']} unresolved HOLD item(s) -- human confirmation required.")
        print(f"Resolve with: python scripts/milestone_provenance.py acknowledge {report['milestone_id']} <path> --reason \"...\"")
    else:
        ack_note = f" ({report['acknowledged_hold_count']} previously acknowledged)" if report["acknowledged_hold_count"] else ""
        print(f"RESULT: clean -- no unresolved HOLD items{ack_note}.")


# --------------------------------------------------------------------------
# acknowledge
# --------------------------------------------------------------------------

def _resolve_identity(repo_root: Path, explicit_by: Optional[str]) -> str:
    if explicit_by:
        return explicit_by
    name = subprocess.run(["git", "config", "user.name"], cwd=str(repo_root), capture_output=True, text=True)
    email = subprocess.run(["git", "config", "user.email"], cwd=str(repo_root), capture_output=True, text=True)
    name_val = name.stdout.strip() if name.returncode == 0 else ""
    email_val = email.stdout.strip() if email.returncode == 0 else ""
    if name_val or email_val:
        return f"git-config:{name_val} <{email_val}>".strip()
    raise ToolError(
        "No --by value given and no git user.name/user.email is configured in this "
        "repository. Refusing to fabricate an identity for this acknowledgement -- "
        "pass --by explicitly."
    )


def cmd_acknowledge(args: argparse.Namespace) -> int:
    repo_root = find_repo_root(Path.cwd())
    manifest = load_manifest(repo_root, args.milestone_id)

    baseline_sha = manifest["baseline"]["sha"]
    if not sha_exists(repo_root, baseline_sha):
        raise ToolError(f"Baseline commit {baseline_sha} is no longer reachable; refusing to acknowledge.")

    report = classify(repo_root, manifest)

    target = None
    for item in report["hold_protected_modified"] + report["hold_unexpected"]:
        if item["path"] == args.path:
            target = item
            break
    if target is None:
        raise ToolError(
            f"'{args.path}' is not currently classified as a HOLD for milestone "
            f"'{args.milestone_id}'. Nothing to acknowledge. Run `verify` to see current "
            f"classifications."
        )

    by = _resolve_identity(repo_root, args.by)
    current_hash = sha256_file(repo_root / args.path)

    ack = {
        "path": args.path,
        "reason": args.reason,
        "timestamp": now_iso(),
        "by": by,
        "hash_at_acknowledgement": current_hash,
    }

    before_hash = immutable_fields_hash(manifest)
    manifest.setdefault("acknowledgements", []).append(ack)
    after_hash = immutable_fields_hash(manifest)
    if before_hash != after_hash:
        raise ToolError("Internal error: acknowledgement would have altered immutable fields. Aborting.")

    save_manifest(repo_root, args.milestone_id, manifest)

    print(f"Acknowledged HOLD on '{args.path}' for milestone '{args.milestone_id}'")
    print(f"  by     : {by}")
    print(f"  reason : {args.reason}")
    print(f"  time   : {ack['timestamp']}")
    print("Note: this HOLD remains visible in `verify` output, now labeled ACKNOWLEDGED, "
          "rather than being removed from the report.")
    return 0


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="milestone_provenance.py", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_baseline = sub.add_parser("baseline", help="Record an immutable milestone baseline.")
    p_baseline.add_argument("milestone_id")
    p_baseline.add_argument("--scope", default=None, help="Repo-relative subtree to restrict protected/expected classification to.")
    p_baseline.add_argument("--expect", action="append", default=None, metavar="CATEGORY:PATH", help="Declare an expected-scope file, repeatable.")
    p_baseline.add_argument("--notes", default="", help="Free-text notes stored on the manifest.")
    p_baseline.add_argument("--force", action="store_true", help="Override a detected concurrency conflict with another milestone's expected scope.")
    p_baseline.set_defaults(func=cmd_baseline)

    p_verify = sub.add_parser("verify", help="Compare the working tree against a milestone's baseline.")
    p_verify.add_argument("milestone_id")
    p_verify.add_argument("--json", action="store_true", help="Print machine-readable JSON instead of the text report.")
    p_verify.set_defaults(func=cmd_verify)

    p_ack = sub.add_parser("acknowledge", help="Record human acknowledgement of a HOLD item.")
    p_ack.add_argument("milestone_id")
    p_ack.add_argument("path")
    p_ack.add_argument("--reason", required=True)
    p_ack.add_argument("--by", default=None, help="Explicit acknowledger identity. Falls back to git user.name/user.email; never fabricated.")
    p_ack.set_defaults(func=cmd_acknowledge)

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ToolError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
