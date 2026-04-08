---
description: Execute the next pending phase from the implementation plan. One phase per session — stops after completion.
argument-hint: (no arguments needed — auto-detects next phase from implementation plan)
---

## Step 1: Identify the Next Phase

Read `docs/implementation-plan.md`. Check which phases are done:

```bash
git log --oneline --all | head -20
```

Match commit messages (e.g., `feat(inventory): phase 1 - ...`) to phases in the plan. Also check the Session Log section.

If `docs/implementation-plan.md` doesn't exist: **"No implementation plan found. Run /audit first."**
If all phases complete: **"All phases complete. Run /wrap-up for final verification."**

## Step 2: Load Minimal Context

Read only what this phase needs:
- `docs/active-feature.md` — the feature spec
- The section in `docs/implementation-plan.md` for the current phase ONLY
- The specific files listed for this phase

Do NOT read files for future phases.

## Step 3: Verify Clean State

```bash
git status
git diff --stat HEAD
npm run build 2>&1 | tail -5
```

If there are uncommitted changes from an interrupted session:
- Review what's there
- Either commit as WIP or stash
- Then proceed

## Step 4: Execute the Phase

Implement the phase as described in the plan.

Rules:
- Follow existing patterns: Server components for data fetching, client components ('use client') for interactivity
- All Supabase queries use `createClient()` from `@/lib/supabase-server` (server) or `@/lib/supabase` (client)
- Tailwind CSS for all styling — match existing design patterns (rounded-xl, border-gray-200, etc.)
- New components should be in the inventory directory unless they're truly shared
- If you encounter something unexpected, STOP and explain
- Do not modify files outside this phase's scope
- Do not start the next phase

## Step 5: Build Verification

```bash
npm run build 2>&1 | tail -20
```

If build fails, fix compiler/type errors introduced by this phase.

## Step 6: Commit

```bash
git add -A
git commit -m "feat(inventory): phase N - [description from plan]"
```

## Step 7: Update Session Log

Append to the Session Log section of `docs/implementation-plan.md`:

```
- **Phase N** — [date] — [1-line summary] — [commit hash]
```

## Step 8: Report and STOP

```
## Phase [N] Complete

**What was done:** [1-2 sentence summary]
**Files changed:** [list]
**Commit:** [hash]
**Build:** BUILD SUCCEEDED / BUILD FAILED

**Next phase:** Phase [N+1] — [one-line description]
**To continue:** Start a new session and run /phase-start
**To undo this phase:** git revert HEAD
```

**STOP HERE. Do not start the next phase.**
