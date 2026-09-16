# Milestone provenance

This directory holds per-milestone provenance manifests produced by
[`scripts/milestone_provenance.py`](../scripts/milestone_provenance.py). It
exists to answer one question at the end of a milestone: *did anything
outside this milestone's declared scope get touched, and if so, was that
seen and confirmed by a human?*

Git is the authoritative source of truth throughout. This tool does not
replace git, a database, or the project's existing narrative milestone
records in `Products/*/docs/PROJECT_STATUS.md` / `Development-Journal.md` --
it is a thin, mechanical pre-check that runs before those are written, so an
unexpected or protected-but-modified file can't slip into a milestone's
diff unnoticed.

## Workflow

**1. Before starting implementation**, record a baseline:

```bash
python scripts/milestone_provenance.py baseline M4 \
  --scope Products/math-thinking-coach \
  --expect implementation:Products/math-thinking-coach/backend/app/services/new_thing.py \
  --expect tests:Products/math-thinking-coach/backend/tests/test_new_thing.py \
  --expect documentation:Products/math-thinking-coach/docs/PROJECT_STATUS.md
```

This records an immutable `BASELINE_SHA` (current `HEAD`), snapshots every
working-tree change that already exists as `PROTECTED / PRE-EXISTING`
(tracked modifications hashed by patch content, untracked/binary files
hashed by raw content), and stores your declared expected scope. `--scope`
is optional; omit it to cover the whole repository.

**2. Do the milestone's work.**

**3. Before declaring the milestone complete**, verify:

```bash
python scripts/milestone_provenance.py verify M4
```

This diffs the current working tree against `BASELINE_SHA` and classifies
every changed path. Nothing is silently bucketed -- see Classification
below. A non-zero exit code means at least one unresolved `HOLD` exists.

**4. If a `HOLD` is a real, reviewed, intentional change** outside the
declared scope, acknowledge it explicitly (this is a human decision, never
inferred by the tool):

```bash
python scripts/milestone_provenance.py acknowledge M4 path/to/file.py \
  --reason "explain why this was touched and why it's fine" \
  --by "your name"
```

`verify` will keep listing the item, now labeled `ACKNOWLEDGED` with the
reason attached -- acknowledgement never removes it from the report.

## Classification precedence

1. **`EXPECTED`** -- the path is in the milestone's declared `expected_files`.
   Wins even if the same path was also protected at baseline (a file can
   legitimately be both).
2. **`PROTECTED_UNCHANGED`** -- not expected, was dirty/untracked at
   baseline, and its content hash is unchanged since.
3. **`PROTECTED_MODIFIED`** (`HOLD`) -- not expected, was protected, and its
   content changed (including deletion) since baseline.
4. **`UNEXPECTED`** (`HOLD`) -- neither expected nor protected.

An `expected_files` entry that shows **no** change at verify time is
reported separately as `EXPECTED_BUT_UNCHANGED` -- a warning, not a `HOLD`,
so a scope that was declared but never actually acted on doesn't pass
silently.

## What is and isn't authoritative

- **Git SHA / diff / content hashes are authoritative.** All classification
  decisions are made from these.
- **File mtimes are recorded as supporting evidence only**, always labeled
  `SUPPORTING EVIDENCE -- NOT AUTHORITATIVE`, and never influence
  classification. Use them only to help a human guess *when* something
  happened while investigating a `HOLD`.

## Immutability

Once a milestone's baseline is written, `baseline`, `scope`,
`protected_pre_existing`, and `expected_files` can never be silently
rewritten. Running `baseline` again for the same milestone ID is refused
outright -- there is no reset/recreate command. If a baseline needs to be
redone, start a new milestone ID. Every manifest also stores a hash of its
own immutable fields; `verify`/`acknowledge` refuse to run against a
manifest that appears to have been hand-edited.

## Concurrency

This tool is single-milestone-per-branch by design. `baseline` refuses to
start a new milestone if another milestone's declared expected scope is
still dirty in the working tree (i.e. that milestone's work looks
unfinished) -- pass `--force` to override explicitly if you're sure.

## Scope

`--scope` restricts which paths are captured/classified against the
manifest. It does not make changes outside that subtree invisible: `verify`
still reports them, under a separate `OUT OF SCOPE` section, purely
informational and never gating.

## Schema reference

See [`scripts/tests/fixtures/well-formed-manifest-example.json`](../scripts/tests/fixtures/well-formed-manifest-example.json)
for an annotated example manifest (illustrative only, not a real milestone).

## Status

This mechanism applies to milestones started after it was introduced
(2026-09-16). It was **not** applied retroactively to the M3 work already
in progress at that time, since M3's true baseline SHA was never captured
at the point M3 actually began.
