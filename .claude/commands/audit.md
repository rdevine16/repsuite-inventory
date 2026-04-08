---
description: Analyze feature spec, interview user, create phased implementation plan. Start here for any new feature.
argument-hint: (no arguments needed — reads docs/active-feature.md)
---

## Step 1: Read the Feature Spec

Read `docs/active-feature.md`. Understand the goal, requirements, constraints, and acceptance criteria.

## Step 2: Parallel Codebase Scan

Spawn parallel subagents to analyze the codebase:

```
Scan the codebase using parallel subagents:
- Subagent 1: Scan src/app/(dashboard)/ for relevant UI patterns, existing pages, and component structure
- Subagent 2: Scan src/lib/ for data layer patterns, Supabase queries, and utility functions
- Subagent 3: Scan src/components/ for shared UI components and design patterns
- Subagent 4: Check docs/sql/ and any Supabase schema references for database structure
```

Each subagent returns a structured summary. Collect and synthesize.

## Step 3: Interview the User

Before proposing any plan, switch to interview mode. Cover these areas (2-3 questions at a time):

**Architecture Decisions:**
- Should this be a new route or extend an existing page?
- Server components for data fetching, client components for interactivity — any exceptions?
- Any new Supabase tables, views, or RPC functions needed?
- Need any new npm dependencies (charting, date pickers, etc.)?

**Audit Findings:**
- Conflicts or inconsistencies found
- Existing code that might be affected
- Gaps between current state and requirements

**Design & UX:**
- Match existing Tailwind/component styling or need new patterns?
- Mobile responsive requirements?
- Loading states, empty states, error handling approach?

**Data & Performance:**
- Expected data volume (100s vs 1000s of rows)?
- Real-time updates needed (Supabase Realtime)?
- Client-side or server-side pagination/filtering?

Continue interviewing until all ambiguities are resolved.

## Step 4: Completeness Expansion

Before writing any plan, expand the feature spec into its full scope.

### 4a: Data Flow Audit
For every data source this feature touches:
- **Query:** What SQL/Supabase query fetches it? Joins needed?
- **Transform:** Any client-side aggregation, grouping, or computation?
- **Display:** List view, detail view, chart, card?
- **Filter/Sort:** What filtering and sorting options?
- **Empty state:** What does the user see before any data exists?

### 4b: Error & Edge Case Enumeration
- **No data:** Facility with zero inventory, zero cases
- **Large data:** Facility with 2000+ items — pagination strategy
- **Stale data:** Data changed between server render and client interaction
- **RLS:** All queries respect row-level security

### 4c: State & Interaction Analysis
- **URL state:** What's persisted in search params for bookmarking?
- **Loading states:** Suspense boundaries, skeleton loaders
- **Cache invalidation:** Does this interact with Supabase Realtime refresh?

## Step 5: Create the Phased Plan

Create `docs/implementation-plan.md` with:

1. **Summary** — what this plan accomplishes
2. **Key Decisions** — from the interview
3. **Phases** — numbered, ordered, with dependencies

Each phase must include:
- What it does (specific)
- Which files it touches
- What the commit message will be: `feat(scope): phase N - description`
- What `npm run build` should verify
- Estimated complexity (small / medium / large)

## Step 6: Present the Plan

Print the complete plan. Ask:

**"Does this plan look right? Want to change anything before I proceed?"**

Wait for explicit approval.

## Step 7: On Approval — Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/[derived-name]
git add docs/implementation-plan.md docs/active-feature.md
git commit -m "docs: add implementation plan for [feature name]"
```

Tell the user: **"Created branch `feature/[name]`. Run /phase-start to begin Phase 1."**

Then STOP.
