"""Tests for milestone_provenance.py.

Every test runs the tool as a subprocess against an isolated temporary git
repository -- the real repository is never touched. Run with:

    py -3 scripts/tests/test_milestone_provenance.py -v
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "milestone_provenance.py"


def run_tool(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=str(repo),
        capture_output=True,
        text=True,
    )


def run_tool_json(repo: Path, *args: str) -> tuple[dict, subprocess.CompletedProcess]:
    proc = run_tool(repo, *args)
    assert proc.stdout.strip(), f"no stdout from {args}: stderr={proc.stderr}"
    return json.loads(proc.stdout), proc


def git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    result = subprocess.run(["git", *args], cwd=str(repo), capture_output=True, text=True)
    assert result.returncode == 0, f"git {args} failed: {result.stderr}"
    return result


def write(repo: Path, relpath: str, content: str) -> Path:
    p = repo / relpath
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8", newline="\n")
    return p


def write_bytes(repo: Path, relpath: str, content: bytes) -> Path:
    p = repo / relpath
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(content)
    return p


class ProvenanceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.mkdtemp(prefix="milestone_prov_test_")
        self.repo = Path(self._tmp)
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.email", "tester@example.com")
        git(self.repo, "config", "user.name", "Tester")
        git(self.repo, "config", "core.autocrlf", "false")
        write(self.repo, "README.md", "seed\n")
        git(self.repo, "add", "README.md")
        git(self.repo, "commit", "-q", "-m", "initial commit")

    def tearDown(self) -> None:
        shutil.rmtree(self._tmp, ignore_errors=True)

    def commit_all(self, message: str) -> None:
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", message)


class TestCleanBaselineExpectedModification(ProvenanceTestCase):
    """1. clean baseline + expected modification."""

    def test_expected_change_is_classified_expected(self) -> None:
        write(self.repo, "impl.py", "a = 1\n")
        self.commit_all("add impl")

        proc = run_tool(self.repo, "baseline", "M1", "--expect", "implementation:impl.py")
        self.assertEqual(proc.returncode, 0, proc.stderr)

        write(self.repo, "impl.py", "a = 2\n")

        report, proc = run_tool_json(self.repo, "verify", "M1", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(report["unresolved_hold_count"], 0)
        self.assertIn("impl.py", [i["path"] for i in report["expected"]])


class TestPreExistingTrackedUnchanged(ProvenanceTestCase):
    """2. pre-existing tracked modification unchanged."""

    def test_unmodified_protected_tracked_file_is_clean(self) -> None:
        write(self.repo, "foo.py", "a = 1\n")
        self.commit_all("add foo")
        write(self.repo, "foo.py", "a = 1\nb = 2\n")  # dirty before baseline

        proc = run_tool(self.repo, "baseline", "M2")
        self.assertEqual(proc.returncode, 0, proc.stderr)

        report, proc = run_tool_json(self.repo, "verify", "M2", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("foo.py", [i["path"] for i in report["protected_unchanged"]])
        self.assertEqual(report["unresolved_hold_count"], 0)


class TestPreExistingTrackedSubsequentlyChanged(ProvenanceTestCase):
    """3. pre-existing tracked modification subsequently changed -> HOLD."""

    def test_further_edit_to_protected_tracked_file_is_hold(self) -> None:
        write(self.repo, "foo.py", "a = 1\n")
        self.commit_all("add foo")
        write(self.repo, "foo.py", "a = 1\nb = 2\n")  # dirty before baseline

        run_tool(self.repo, "baseline", "M3")

        write(self.repo, "foo.py", "a = 1\nb = 2\nc = 3\n")  # further edit after baseline

        report, proc = run_tool_json(self.repo, "verify", "M3", "--json")
        self.assertEqual(proc.returncode, 1)
        paths = [i["path"] for i in report["hold_protected_modified"]]
        self.assertIn("foo.py", paths)
        self.assertEqual(report["unresolved_hold_count"], 1)


class TestPreExistingUntrackedUnchanged(ProvenanceTestCase):
    """4. pre-existing untracked file unchanged."""

    def test_unmodified_protected_untracked_file_is_clean(self) -> None:
        write(self.repo, "scratch.txt", "notes\n")  # untracked, pre-existing

        run_tool(self.repo, "baseline", "M4")

        report, proc = run_tool_json(self.repo, "verify", "M4", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("scratch.txt", [i["path"] for i in report["protected_unchanged"]])


class TestPreExistingUntrackedSubsequentlyChanged(ProvenanceTestCase):
    """5. pre-existing untracked file subsequently changed -> HOLD."""

    def test_edited_protected_untracked_file_is_hold(self) -> None:
        write(self.repo, "scratch.txt", "notes\n")  # untracked, pre-existing

        run_tool(self.repo, "baseline", "M5")

        write(self.repo, "scratch.txt", "notes\nmore notes\n")

        report, proc = run_tool_json(self.repo, "verify", "M5", "--json")
        self.assertEqual(proc.returncode, 1)
        paths = [i["path"] for i in report["hold_protected_modified"]]
        self.assertIn("scratch.txt", paths)


class TestNewUnexpectedChange(ProvenanceTestCase):
    """6. new unexpected tracked/untracked change -> HOLD."""

    def test_unexpected_tracked_and_untracked_changes_are_hold(self) -> None:
        write(self.repo, "other.py", "a = 1\n")
        self.commit_all("add other")

        run_tool(self.repo, "baseline", "M6")  # clean tree, no expects

        write(self.repo, "other.py", "a = 999\n")  # unexpected tracked modification
        write(self.repo, "oops.txt", "surprise\n")  # unexpected new untracked file

        report, proc = run_tool_json(self.repo, "verify", "M6", "--json")
        self.assertEqual(proc.returncode, 1)
        paths = [i["path"] for i in report["hold_unexpected"]]
        self.assertIn("other.py", paths)
        self.assertIn("oops.txt", paths)
        self.assertEqual(report["unresolved_hold_count"], 2)


class TestExpectedFileCreatedAfterBaseline(ProvenanceTestCase):
    """7. expected file created after baseline."""

    def test_expected_file_starts_unchanged_then_becomes_expected(self) -> None:
        run_tool(self.repo, "baseline", "M7", "--expect", "implementation:new_module.py")

        report, proc = run_tool_json(self.repo, "verify", "M7", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("new_module.py", [i["path"] for i in report["expected_but_unchanged"]])
        self.assertNotIn("new_module.py", [i["path"] for i in report["expected"]])

        write(self.repo, "new_module.py", "def f(): pass\n")

        report, proc = run_tool_json(self.repo, "verify", "M7", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("new_module.py", [i["path"] for i in report["expected"]])
        self.assertNotIn("new_module.py", [i["path"] for i in report["expected_but_unchanged"]])


class TestExpectedFileProtectedThenModified(ProvenanceTestCase):
    """8. expected file protected at baseline and subsequently modified -> EXPECTED wins."""

    def test_expected_overrides_protected_classification(self) -> None:
        write(self.repo, "dual.py", "a = 1\n")
        self.commit_all("add dual")
        write(self.repo, "dual.py", "a = 1\nb = 2\n")  # dirty before baseline

        run_tool(self.repo, "baseline", "M8", "--expect", "implementation:dual.py")

        write(self.repo, "dual.py", "a = 1\nb = 2\nc = 3\n")  # further edit, in scope

        report, proc = run_tool_json(self.repo, "verify", "M8", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("dual.py", [i["path"] for i in report["expected"]])
        self.assertNotIn("dual.py", [i["path"] for i in report["hold_protected_modified"]])
        self.assertEqual(report["unresolved_hold_count"], 0)


class TestBinaryProtectedFile(ProvenanceTestCase):
    """9. binary protected file."""

    def test_binary_file_uses_content_hash_classification(self) -> None:
        write_bytes(self.repo, "image.bin", bytes([0, 1, 2, 3, 0, 255, 254]))
        self.commit_all("add binary")
        write_bytes(self.repo, "image.bin", bytes([0, 1, 2, 3, 0, 255, 253]))  # dirty before baseline

        run_tool(self.repo, "baseline", "M9")

        protected = json.loads((self.repo / ".milestones" / "M9-manifest.json").read_text())["protected_pre_existing"]
        entry = next(e for e in protected if e["path"] == "image.bin")
        self.assertTrue(entry["is_binary"])
        self.assertIsNone(entry["patch_sha256"])
        self.assertIsNotNone(entry["content_sha256"])

        report, proc = run_tool_json(self.repo, "verify", "M9", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("image.bin", [i["path"] for i in report["protected_unchanged"]])

        write_bytes(self.repo, "image.bin", bytes([9, 9, 9]))  # further change after baseline

        report, proc = run_tool_json(self.repo, "verify", "M9", "--json")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("image.bin", [i["path"] for i in report["hold_protected_modified"]])


class TestRenameHandling(ProvenanceTestCase):
    """10. rename handling -- a protected rename must not read as delete+add.

    Uses a realistically sized file (not a 1-line stub) so git's own -M
    similarity heuristic -- which compares against the last *commit*, not
    the dirty pre-baseline state -- stays comfortably above its default 50%
    threshold across both edits. A tiny file mutated twice no longer looks
    like a rename to git itself; that is a git limitation, not something
    this tool can or should work around.
    """

    ORIGINAL = "".join(f"line{i}\n" for i in range(1, 11))  # 10 lines

    def test_rename_of_protected_file_preserves_identity(self) -> None:
        write(self.repo, "old_name.py", self.ORIGINAL)
        self.commit_all("add old_name")
        write(self.repo, "old_name.py", self.ORIGINAL + "line11\n")  # dirty before baseline

        run_tool(self.repo, "baseline", "M10")

        git(self.repo, "add", "old_name.py")
        git(self.repo, "mv", "old_name.py", "new_name.py")

        report, proc = run_tool_json(self.repo, "verify", "M10", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        unchanged_paths = [i["path"] for i in report["protected_unchanged"]]
        self.assertIn("new_name.py", unchanged_paths)
        self.assertNotIn("old_name.py", [i["path"] for i in report["hold_unexpected"]])
        self.assertNotIn("new_name.py", [i["path"] for i in report["hold_unexpected"]])

        write(self.repo, "new_name.py", self.ORIGINAL + "line11\nline12\n")  # edit after rename

        report, proc = run_tool_json(self.repo, "verify", "M10", "--json")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("new_name.py", [i["path"] for i in report["hold_protected_modified"]])


class TestAcknowledgementPersistence(ProvenanceTestCase):
    """11. acknowledgement persistence."""

    def test_acknowledge_is_recorded_and_clears_exit_code(self) -> None:
        run_tool(self.repo, "baseline", "M11")
        write(self.repo, "oops.txt", "surprise\n")

        report, proc = run_tool_json(self.repo, "verify", "M11", "--json")
        self.assertEqual(proc.returncode, 1)

        proc = run_tool(self.repo, "acknowledge", "M11", "oops.txt", "--reason", "reviewed, expected scratch file", "--by", "tester")
        self.assertEqual(proc.returncode, 0, proc.stderr)

        manifest = json.loads((self.repo / ".milestones" / "M11-manifest.json").read_text())
        self.assertEqual(len(manifest["acknowledgements"]), 1)
        ack = manifest["acknowledgements"][0]
        self.assertEqual(ack["path"], "oops.txt")
        self.assertEqual(ack["reason"], "reviewed, expected scratch file")
        self.assertEqual(ack["by"], "tester")
        self.assertIn("timestamp", ack)

        report, proc = run_tool_json(self.repo, "verify", "M11", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(report["unresolved_hold_count"], 0)


class TestAcknowledgementDoesNotEraseEvidence(ProvenanceTestCase):
    """12. acknowledgement does not erase original HOLD evidence."""

    def test_acknowledged_hold_still_listed_with_metadata(self) -> None:
        run_tool(self.repo, "baseline", "M12")
        write(self.repo, "oops.txt", "surprise\n")
        run_tool(self.repo, "verify", "M12", "--json")
        run_tool(self.repo, "acknowledge", "M12", "oops.txt", "--reason", "known scratch file", "--by", "tester")

        report, proc = run_tool_json(self.repo, "verify", "M12", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        item = next(i for i in report["hold_unexpected"] if i["path"] == "oops.txt")
        self.assertTrue(item["acknowledged"])
        self.assertEqual(item["acknowledgement"]["reason"], "known scratch file")
        # The item is still present under hold_unexpected, not silently removed.


class TestImmutableBaselineFields(ProvenanceTestCase):
    """13. immutable baseline fields."""

    def test_second_baseline_with_same_id_is_refused(self) -> None:
        proc = run_tool(self.repo, "baseline", "M13")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        manifest_path = self.repo / ".milestones" / "M13-manifest.json"
        original = manifest_path.read_text()

        write(self.repo, "new_file.py", "a = 1\n")  # change tree state
        proc = run_tool(self.repo, "baseline", "M13")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("already exists", proc.stderr)
        self.assertEqual(manifest_path.read_text(), original)

    def test_tampered_manifest_is_rejected(self) -> None:
        run_tool(self.repo, "baseline", "M13B")
        manifest_path = self.repo / ".milestones" / "M13B-manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["baseline"]["sha"] = "0" * 40  # tamper with an immutable field
        manifest_path.write_text(json.dumps(manifest))

        proc = run_tool(self.repo, "verify", "M13B", "--json")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("integrity check", proc.stderr)


class TestMalformedOrMissingManifest(ProvenanceTestCase):
    """14. malformed/missing manifest."""

    def test_missing_manifest_is_a_clear_error(self) -> None:
        proc = run_tool(self.repo, "verify", "NOPE", "--json")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("No manifest found", proc.stderr)

    def test_malformed_manifest_is_a_clear_error(self) -> None:
        fixture = Path(__file__).parent / "fixtures" / "malformed-manifest-example.json"
        target = self.repo / ".milestones"
        target.mkdir(parents=True, exist_ok=True)
        shutil.copy(fixture, target / "BAD-manifest.json")

        proc = run_tool(self.repo, "verify", "BAD", "--json")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("malformed", proc.stderr)


class TestExpectedButUnchangedWarning(ProvenanceTestCase):
    """15. expected-but-unchanged warning."""

    def test_expected_file_with_no_changes_is_a_warning_not_a_hold(self) -> None:
        write(self.repo, "untouched.py", "a = 1\n")
        self.commit_all("add untouched")

        run_tool(self.repo, "baseline", "M15", "--expect", "implementation:untouched.py")

        report, proc = run_tool_json(self.repo, "verify", "M15", "--json")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("untouched.py", [i["path"] for i in report["expected_but_unchanged"]])
        self.assertEqual(report["unresolved_hold_count"], 0)


class TestConcurrentOverlappingMilestones(ProvenanceTestCase):
    """16. concurrent/overlapping milestone protection."""

    def test_second_baseline_conflicting_with_first_is_refused(self) -> None:
        write(self.repo, "shared.py", "a = 1\n")
        self.commit_all("add shared")
        write(self.repo, "shared.py", "a = 1\nb = 2\n")  # milestone A's in-progress work

        proc = run_tool(self.repo, "baseline", "M16A", "--expect", "implementation:shared.py")
        self.assertEqual(proc.returncode, 0, proc.stderr)

        # shared.py is still dirty (M16A's declared scope) -- a second, unrelated
        # milestone baselining now would misclassify or collide with it.
        proc = run_tool(self.repo, "baseline", "M16B", "--expect", "implementation:shared.py")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("M16A", proc.stderr)
        self.assertIn("shared.py", proc.stderr)
        self.assertFalse((self.repo / ".milestones" / "M16B-manifest.json").exists())

        # --force explicitly overrides, with the override recorded, not silent.
        proc = run_tool(self.repo, "baseline", "M16B", "--expect", "implementation:shared.py", "--force")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        manifest = json.loads((self.repo / ".milestones" / "M16B-manifest.json").read_text())
        self.assertIn("--force", manifest["notes"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
