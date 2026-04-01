# Implant Coverage Engine — Complete Specification

> This document is the definitive reference for how the inventory coverage system works.
> Any Claude Code session building features related to surgeon preferences, case coverage,
> inventory alerts, or kit recommendations should read this first.

---

## Table of Contents

1. [Domain Context](#1-domain-context)
2. [Implant Taxonomy](#2-implant-taxonomy)
3. [Surgeon Implant Plans](#3-surgeon-implant-plans)
4. [The Coverage Formula](#4-the-coverage-formula)
5. [Worked Examples](#5-worked-examples)
6. [Data Model](#6-data-model)
7. [Coverage Engine Logic](#7-coverage-engine-logic)
8. [Intraday Consumption Tracking](#8-intraday-consumption-tracking)
9. [Kit Recommendations](#9-kit-recommendations)
10. [Edge Cases & Rules](#10-edge-cases--rules)

---

## 1. Domain Context

### What This System Is
RepSuite Inventory is an intelligence layer for orthopedic surgical implant management. The user (Ryan) is a Stryker surgical rep who manages implant inventory across multiple hospital facilities. Cases (surgeries) are booked and ordered through a separate system called RepSuite. This app provides the intelligence: tracking what's on hand, what's needed, and whether coverage is adequate.

### The Core Problem
Before a surgery day, the rep needs to ensure that every scheduled case has adequate implant coverage at the facility. Implants are expensive and shipped in complete sets (tubs). The goal is to **minimize the number of sets sent** while **ensuring no case is left without the implant it needs**.

### How Implants Work
- Implants are shipped in **complete sets (tubs)** — you cannot send individual sizes
- One set = one of every size in that variant (e.g., 8 femurs, sizes 1-8)
- Each surgical case consumes **one implant per component** (one femur, one tibia, one patella, one poly)
- The exact size needed is **unknown until the surgeon is in surgery**
- After a case uses size X, that size is gone from the set — but all other sizes remain available for the next case
- All implants at a facility are shared across all surgeons and all cases that day

### Why This Matters
If two cases on the same day need the same size in the same variant, and you only have one set, the second case has a gap. You cannot tell a surgeon mid-surgery "we don't have your size." The system must ensure this never happens by recommending the right number of sets.

---

## 2. Implant Taxonomy

### Knee Components

#### Femoral Components (`knee_femur`)
- **Sizes:** 1, 2, 3, 4, 5, 6, 7, 8
- **Side-specific:** Yes — Left and Right are separate implants
- **Variants:**
  - CR Pressfit (cruciate-retaining, press-fit fixation)
  - CR Cemented (cruciate-retaining, cemented fixation)
  - PS Pressfit (posterior-stabilized, press-fit fixation)
  - PS Cemented (posterior-stabilized, cemented fixation)
  - PS Pro Cemented (posterior-stabilized revision)
- **One set** = 8 implants (sizes 1-8) for ONE side
- **Ref patterns:** `5517-F-{size}01` (Left CR PF), `5517-F-{size}02` (Right CR PF), `5510-F-{size}01` (Left CR Cem), etc.

#### Tibial Baseplates (`knee_tibia`)
- **Sizes:** 1, 2, 3, 4, 5, 6, 7, 8
- **Side-specific:** No — universal fit
- **Variants:**
  - Primary (cemented)
  - Universal (cemented)
  - MIS (cemented, minimally invasive)
  - Tritanium (pressfit)
- **One set** = 8 implants (sizes 1-8)

#### Patella (`knee_patella`)
- **Side-specific:** No
- **Variants and their sizes:**
  - Asymmetric Cemented: 29, 32, 35, 38, 40 (5 sizes)
  - Asymmetric Pressfit: 29, 32, 35, 38, 40 (5 sizes)
  - Symmetric Cemented: 27, 29, 31, 33, 36, 39 (6 sizes)
  - Symmetric Pressfit: 29, 31, 33, 36, 39 (5 sizes)
- **One set** = all sizes for that variant (5 or 6 implants)

#### Poly Inserts (`knee_poly`)
- **Side-specific:** No
- **2D grid:** Each poly is identified by knee size (1-8) AND thickness
- **Variants and thicknesses:**
  - CS (pairs with CR femurs): thicknesses 9, 10, 11, 12, 13, 14, 16, 19
  - PS (pairs with PS femurs): thicknesses 9, 10, 11, 12, 13, 14, 16, 19
  - TS (pairs with PS femurs — alternate): thicknesses 9, 11, 13, 16, 19, 22, 25, 28, 31
- **One set** = all size/thickness combinations (8 sizes x 8 thicknesses = 64 for CS/PS, 8x9=72 for TS)
- **Note:** PS femurs can use EITHER PS polys or TS polys. Some surgeons prefer TS with their PS femurs.

#### Tibial Stems (`knee_tibial_stem`)
- **2D grid:** Length (50mm, 100mm) x Diameter (9, 12, 15)
- **One set** = all combinations (6 implants)

### Hip Components

#### Stems (`hip_stem`)
- **Sizes:** 0-11 (varies by variant)
- **Variants:** Accolade II 132°, Accolade II 127°, Accolade C 132°, Accolade C 127°, Insignia Standard, Insignia High
- **One set** = all sizes for that variant (up to 12 implants)

#### Cups (`hip_cup`)
- **Sizes:** 42A through 66H
- **Variants:** Trident II Tritanium, Trident PSL HA
- **One set** = all sizes for that variant

#### Liners, Heads, Screws
- See `hip-config.ts` for full variant/size breakdowns
- Heads and screws are **consumable** — one used per case, not reusable like tubs

---

## 3. Surgeon Implant Plans

### Why Plans, Not Flat Preferences

A surgeon's implant choices are **linked decisions**, not independent per-component picks. When a surgeon decides to cement instead of pressfit, the femur, tibia, AND patella all change together. When they switch from CR to PS, the poly changes too.

The old model (flat: component → variant → priority) cannot capture these relationships.

### The Implant Plan Model

Each surgeon has **multiple implant plans** per procedure type. Each plan is a coherent set of component choices that go together.

#### Plan Types

| Plan Type | Description | Sets Rule |
|-----------|-------------|-----------|
| **Primary** | What the surgeon intends to use. Their go-to implant system. | 1 set per case |
| **Cemented Fallback** | Same constraint system (CR or PS) but cemented fixation. Used when bone quality is poor or the surgeon decides intraop to cement. | 1:1 with primary (always paired) |
| **Clinical Alternate** | Different constraint system entirely (e.g., CR surgeon going PS). Only happens when the patient's anatomy demands it — ligament laxity, can't balance the knee, needs more stability. | Configurable per surgeon (see conversion likelihood) |

#### Critical Distinction: Clinical Alternate Is NOT a Backup

"Backup" implies "use this if the preferred isn't available." That is NOT what clinical alternate means. A surgeon who prefers CR will ALWAYS want CR available. They switch to PS only because the **patient's knee requires it** — it's a clinical decision made during surgery, not an inventory-driven substitution.

This means:
- You cannot pool CR + PS inventory for coverage purposes
- Each variant needs its own independent coverage
- Running out of CR doesn't mean "just use PS" — the surgeon needs BOTH available

#### Cemented Fallback — Always Paired 1:1

Any case that uses pressfit could end up needing cemented instead. This is decided intraoperatively. Therefore:
- If you send 4 sets of CR Pressfit femurs, you MUST also have 4 sets of CR Cemented femurs
- The cemented fallback is always 1:1 with the primary — same number of sets
- This also cascades to tibias and patellas (pressfit tibia → cemented tibia backup, pressfit patella → cemented patella backup)

#### Conversion Likelihood for Clinical Alternate

Different surgeons have different thresholds for switching constraint systems. This is configurable:

| Likelihood | Description | Sets Rule |
|------------|-------------|-----------|
| **Low** | Surgeon rarely switches (maybe 1 in 20 cases) | 1 set regardless of case count |
| **Medium** | Surgeon switches occasionally (maybe 1 in 5 cases) | 1 set per 3 cases (round up) |
| **High** | Surgeon switches frequently (maybe 1 in 3 cases) | 1 set per 2 cases (round up) |

### Example: Surgeon 1 (CR Pressfit Primary)

| Plan | Femur | Tibia | Patella | Poly | Sets Rule |
|------|-------|-------|---------|------|-----------|
| **Primary** | CR Pressfit | Tritanium | Asym Pressfit | CS | 1 per case |
| **Cemented Fallback** | CR Cemented | Universal | Asym Cemented | CS | 1:1 with primary |
| **Clinical Alt (Low)** | PS Cemented | Universal | Sym Cemented | PS, TS | 1 set total |

### Example: Surgeon 2 (CR Pressfit Primary, different tibia)

| Plan | Femur | Tibia | Patella | Poly | Sets Rule |
|------|-------|-------|---------|------|-----------|
| **Primary** | CR Pressfit | Primary (cem) | Asym Pressfit | CS | 1 per case |
| **Cemented Fallback** | CR Cemented | Primary (cem) | Asym Cemented | CS | 1:1 with primary |
| **Clinical Alt (Low)** | PS Cemented | Universal | Sym Cemented | PS, TS | 1 set total |

Note: Surgeon 2 already uses a cemented tibia (Primary) as their go-to, so the cemented fallback tibia doesn't change. The fallback only changes components that were pressfit in the primary plan.

### Example: Surgeon 3 (PS Primary — no CR needed)

| Plan | Femur | Tibia | Patella | Poly | Sets Rule |
|------|-------|-------|---------|------|-----------|
| **Primary** | PS Cemented | Universal | Sym Cemented | TS | 1 per case |

No cemented fallback needed (already cemented). No clinical alternate needed (already PS — there's no "more constrained" option in standard primary TKA).

### Poly-Femur Pairing Rules

- **CR femurs** → use **CS polys** (cruciate-substituting)
- **PS femurs** → use **PS polys** OR **TS polys** (surgeon preference which one)
- A surgeon who uses PS femurs with TS polys should have TS as their poly in the plan
- Some surgeons want BOTH PS and TS polys available when using PS femurs — the poly_variants field is an array to support this

---

## 4. The Coverage Formula

### The Core Rule

**Sets needed = number of cases that could use this variant.**

This is not probabilistic. It is absolute. Here's why:

After case 1 uses a size 5 femur, that size is gone. If case 2 also needs a size 5, you need a second complete set. Since you don't know sizes in advance, you MUST have a fresh complete set available for every case.

### Formula by Plan Type

```
For a given facility + day + variant + side:

Primary sets needed = count of cases where this is the primary plan
Cemented fallback sets needed = same as primary (1:1 paired)
Clinical alternate sets needed = f(conversion_likelihood, case_count)
  - Low:    1
  - Medium: ceil(case_count / 3)
  - High:   ceil(case_count / 2)
```

### Aggregation Across Surgeons

Implants at a facility are shared across ALL surgeons. If Surgeon 1 and Surgeon 2 both use CR Pressfit as primary:

```
Total CR Pressfit Left Femur sets needed =
  Surgeon 1 left cases + Surgeon 2 left cases
```

Clinical alternate sets can be shared too — if both surgeons have PS as clinical alternate:

```
Total PS sets needed =
  max(Surgeon 1 clinical alt sets, Surgeon 2 clinical alt sets)
  ... unless Surgeon 3 uses PS as PRIMARY, in which case:
  Surgeon 3 primary PS sets + max(S1 alt, S2 alt)
```

Wait — this needs careful thought. If Surgeon 3 uses PS as primary (3 cases) and Surgeons 1 & 2 have PS as clinical alt:
- Surgeon 3 needs 3 PS sets for their cases
- Surgeons 1 & 2 might need 1 PS set as clinical alt
- But Surgeon 3's sets are being consumed by Surgeon 3's cases
- The alt cases would happen during S1/S2's surgeries when S3's sets might already be depleted

**Safe rule: Add primary + clinical alternate demands. Don't assume sharing.**

```
Total PS Left Femur sets =
  (S3 primary left cases) + (S1 clinical alt sets) + (S2 clinical alt sets)
```

This is conservative but safe. The alternative is a mid-surgery gap.

### Counting Sets On Hand

To determine how many complete sets of a variant are on hand:

```
For variant V with sizes [s1, s2, ..., sN]:
  count_per_size = { s1: 3, s2: 2, s3: 4, ... }
  complete_sets = min(count_per_size for all sizes)
```

If you have 2 of every size except size 5 (only 1), you have **1 complete set**. The extra units in other sizes don't help — a set is only complete if ALL sizes are present.

### Gap Calculation

```
gap = sets_needed - sets_on_hand
if gap > 0: recommend shipping {gap} tubs of this variant
if gap <= 0: covered
```

---

## 5. Worked Examples

### Example A: Simple Day — One Surgeon

**Facility:** Memorial Hospital, Tuesday
**Cases:** Dr. Berra has 3 TKAs — 2 Left, 1 Right

**Dr. Berra's Plans:**
- Primary: CR Pressfit femur, Tritanium tibia, Asym Pressfit patella, CS poly
- Cemented: CR Cemented femur, Universal tibia, Asym Cemented patella, CS poly
- Clinical Alt (Low): PS Cemented femur, Universal tibia, Sym Cemented patella, PS poly

**Sets Needed:**

| Variant + Side | Primary | Cemented | Clinical Alt | Total |
|----------------|---------|----------|-------------|-------|
| CR PF Left Femur | 2 | — | — | 2 |
| CR PF Right Femur | 1 | — | — | 1 |
| CR Cem Left Femur | — | 2 | — | 2 |
| CR Cem Right Femur | — | 1 | — | 1 |
| PS Cem Left Femur | — | — | 1 (low) | 1 |
| PS Cem Right Femur | — | — | 1 (low) | 1 |
| Tritanium Tibia | 3 | — | — | 3 |
| Universal Tibia | — | 3 | 1 | 4 |
| Asym PF Patella | 3 | — | — | 3 |
| Asym Cem Patella | — | 3 | — | 3 |
| Sym Cem Patella | — | — | 1 | 1 |
| CS Poly | 3 | 3 (same) | — | 3* |
| PS Poly | — | — | 1 | 1 |

*CS Poly is the same for primary and cemented fallback — it's the same poly type regardless of fixation. So 3 sets, not 6.

**On Hand (example):**
- CR PF Left Femur: 1 set → GAP: need 1 more tub
- CR PF Right Femur: 1 set → Covered
- CR Cem Left Femur: 1 set → GAP: need 1 more tub
- CR Cem Right Femur: 1 set → Covered
- Tritanium Tibia: 2 sets → GAP: need 1 more tub
- Universal Tibia: 3 sets → GAP: need 1 more tub
- etc.

### Example B: Complex Day — Three Surgeons

**Facility:** Regional Medical Center, Wednesday
**Cases:**
- Surgeon 1: 4 TKAs (2 Left, 2 Right) — CR Pressfit primary, PS clinical alt (Low)
- Surgeon 2: 5 Mako TKAs (2 Left, 3 Right) — CR Pressfit primary, PS clinical alt (Low)
- Surgeon 3: 3 TKAs (1 Left, 2 Right) — PS Cemented primary, no clinical alt

**Note:** Mako TKAs use the same implants as standard TKAs — it's just a different procedure type tracked separately.

**Aggregated Sets Needed:**

| Variant + Side | S1 Primary | S2 Primary | S3 Primary | S1 Alt | S2 Alt | Total |
|----------------|-----------|-----------|-----------|--------|--------|-------|
| CR PF Left Femur | 2 | 2 | — | — | — | **4** |
| CR PF Right Femur | 2 | 3 | — | — | — | **5** |
| CR Cem Left Femur | 2 | 2 | — | — | — | **4** |
| CR Cem Right Femur | 2 | 3 | — | — | — | **5** |
| PS Cem Left Femur | — | — | 1 | 1 | 1 | **3** |
| PS Cem Right Femur | — | — | 2 | 1 | 1 | **4** |

**Tibia aggregation (not side-specific):**

| Variant | S1 (4 cases) | S2 (5 cases) | S3 (3 cases) | S1 Alt | S2 Alt | Total |
|---------|-------------|-------------|-------------|--------|--------|-------|
| Tritanium | 4 | 5 | — | — | — | **9** |
| Universal | 4 (cem fb) | 5 (cem fb) | 3 (primary) | 1 | 1 | **14** |

Wait — this is where it gets interesting. Universal tibia is needed by:
- S1 cemented fallback: 4 sets
- S2 cemented fallback: 5 sets
- S3 primary: 3 sets
- S1 clinical alt: 1 set
- S2 clinical alt: 1 set

But all these are from the SAME pool of universal tibias at the facility. In the absolute worst case, all of these happen simultaneously — but they won't, because a case is either cemented OR pressfit, not both. And clinical alt is rare.

**Practical simplification:** The cemented fallback tibias don't STACK with primary tibias because they're alternatives for the same case. A case uses EITHER tritanium OR universal, not both.

So the real universal tibia need is:
- S3 primary: 3 cases (will definitely use universal)
- S1 cemented fallback: up to 4 cases COULD switch to universal (but they'd stop using tritanium)
- S2 cemented fallback: up to 5 cases COULD switch
- S1/S2 clinical alt: up to 2 more cases could use universal

**Conservative rule:** Primary demand + clinical alt demand. Cemented fallback doesn't add demand for tibias IF the primary tibia is already cemented. If primary tibia is pressfit (Tritanium), cemented fallback needs its own tibia sets equal to primary.

```
Universal tibia sets needed:
  S3 primary:        3 (will use universal)
  S1 cemented fb:    4 (if any of S1's cases cement, they need universal instead of tritanium)
  S2 cemented fb:    5 (same logic)
  S1 clinical alt:   1
  S2 clinical alt:   1
  Total:            14
```

This is the safe maximum. In practice, you'd never have ALL 9 CR cases switch to cemented AND both alts fire. But the system should show this as the theoretical maximum and let the rep make the judgment call.

**Recommendation format:**
```
Universal Tibia: 14 sets needed (worst case)
  - 3 sets: Surgeon 3 primary (certain)
  - 9 sets: S1+S2 cemented fallback (if pressfit cases cement)
  - 2 sets: S1+S2 clinical alternate (if cases go PS)
  On hand: 6 sets
  Gap: 8 sets (worst case) / 0 sets (if no cementing or PS conversion)
```

The rep can then decide: "I'll send 6 total — 3 for S3 + 3 buffer for cementing. That's enough."

---

## 6. Data Model

### Plans Are Reusable Templates Assigned to Cases

A surgeon can have **multiple named plans**. Each plan is a complete template containing
primary components, cemented fallback, and optionally a clinical alternate — all in one row.

Cases get assigned a specific plan. This lets the rep say "this case is CR Pressfit" and
"this other case is PS Pro" for the same surgeon. The coverage engine reads the plan from
each case, not from a global surgeon preference.

### Table: `surgeon_implant_plans`

```sql
CREATE TABLE surgeon_implant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_name TEXT NOT NULL,
  plan_name TEXT NOT NULL,                -- "CR Pressfit Knee", "PS Pro Knee"
  procedure_type TEXT NOT NULL,           -- 'knee' or 'hip'
  is_default BOOLEAN DEFAULT false,       -- Auto-assign to new cases

  -- Primary plan components
  femur_variant TEXT,
  tibia_variant TEXT,
  patella_variant TEXT,
  poly_variants TEXT[] DEFAULT '{}',

  -- Cemented fallback (1:1 with primary)
  cemented_femur_variant TEXT,
  cemented_tibia_variant TEXT,
  cemented_patella_variant TEXT,

  -- Clinical alternate
  has_clinical_alternate BOOLEAN DEFAULT false,
  alt_femur_variant TEXT,
  alt_tibia_variant TEXT,
  alt_patella_variant TEXT,
  alt_poly_variants TEXT[] DEFAULT '{}',
  alt_conversion_likelihood TEXT,         -- 'low'/'medium'/'high'

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Case Assignment

The `cases` table has a `plan_id` column referencing `surgeon_implant_plans.id`.

- If a case has `plan_id` set, the coverage engine uses that plan
- If `plan_id` is NULL, the engine falls back to the surgeon's default plan (where `is_default = true` for that surgeon + procedure type)
- If no default exists, the case shows as "No plan" in the coverage audit

### Key Differences from Previous Model
- Plans are NOT locked to one-per-surgeon-per-procedure — a surgeon can have many plans
- Each plan contains primary + cemented + clinical alt in ONE row (not separate rows)
- Cases reference a specific plan, allowing per-case control
- `is_default` flag lets new cases auto-assign without manual intervention

### Procedure Type Normalization

Mako TKA and standard TKA use the same implants. The system should treat them as equivalent for coverage purposes:

```typescript
function normalizeProcedureType(procedureName: string): string {
  const lower = procedureName.toLowerCase()
  if (lower.includes('tka') || lower.includes('total knee') || lower.includes('mako') && lower.includes('knee'))
    return 'knee'
  if (lower.includes('tha') || lower.includes('total hip'))
    return 'hip'
  // ... etc
}
```

### Side Detection

Side comes from the procedure name in RepSuite:
- "Left TKA" → left
- "Right Mako TKA" → right
- If side is ambiguous, assume BOTH sides needed (worst case)

---

## 7. Coverage Engine Logic

### Input
- Facility ID
- Date (or date range)

### Step 1: Get Cases
```
SELECT * FROM cases
WHERE facility_id = :facility
  AND surgery_date BETWEEN :start AND :end
  AND status != 'Completed'
  AND status != 'Cancelled'
```

### Step 2: Group Cases
```
Group by: surgeon_name, procedure_type (normalized), side
Count cases per group
```

### Step 3: Load Implant Plans
```
SELECT * FROM surgeon_implant_plans
WHERE surgeon_name IN (:surgeon_names)
  AND procedure_type IN (:procedure_types)
```

### Step 4: Calculate Demand Per Variant

For each component type (femur, tibia, patella, poly):

```typescript
interface VariantDemand {
  variant: string
  side?: 'left' | 'right'  // only for femurs
  sets_needed: number
  sources: {
    surgeon: string
    plan_type: string
    cases: number
    sets: number
  }[]
}
```

**Aggregation rules:**

For **femurs** (side-specific):
```
For each variant + side:
  sum across all surgeons:
    primary: count of that surgeon's cases on that side
    cemented_fallback: same count (1:1)
    clinical_alternate: apply conversion_likelihood formula
```

For **tibias** (not side-specific):
```
For each variant:
  sum across all surgeons:
    primary: count of all that surgeon's cases (both sides)
    cemented_fallback: same count if primary tibia was pressfit (tritanium)
                       0 if primary tibia was already cemented (no change needed)
    clinical_alternate: apply formula to total case count
```

For **patellas** (not side-specific):
```
Same as tibias — sum total cases per surgeon
Cemented fallback: needed if primary patella was pressfit
```

For **polys** (not side-specific):
```
Same as tibias — sum total cases per surgeon
Note: poly_variants is an array — if ['ps', 'ts'], need sets of BOTH
Each poly variant in the array needs its own sets
```

### Step 5: Count Sets On Hand

For each variant:
```typescript
function countCompleteSets(
  onHandCounts: Record<string, number>,  // from buildOnHandCounts()
  category: string,
  variant: string,
  sizes: string[]
): number {
  const countsPerSize = sizes.map(size => {
    const key = `${category}|${variant}|${size}`
    return onHandCounts[key] ?? 0
  })
  return Math.min(...countsPerSize)
}
```

Also count loaner kits that are physically at the facility (status = "Shipped/Ready for Surgery").

### Step 6: Calculate Gaps

```
gap = sets_needed - sets_on_hand
status:
  gap <= 0   → COVERED
  gap > 0    → SHORT (need {gap} more tubs)
```

### Step 7: Generate Output

```typescript
interface CoverageResult {
  facility_id: string
  date: string
  total_cases: number
  cases_by_surgeon: { surgeon: string, count: number, sides: { left: number, right: number } }[]
  coverage: {
    component: string       // 'femur', 'tibia', 'patella', 'poly'
    variant: string         // 'cr_pressfit', 'universal', etc.
    side?: string           // 'left' | 'right' (femurs only)
    sets_needed: number
    sets_on_hand: number
    gap: number
    demand_breakdown: {     // Shows where the demand comes from
      surgeon: string
      plan_type: string
      cases: number
      sets_from_this: number
    }[]
    status: 'covered' | 'short'
  }[]
  recommendations: {
    action: string          // "Send 2 CR Pressfit Left Femur tubs"
    variant: string
    side?: string
    tubs_needed: number
    priority: 'required' | 'recommended' | 'optional'
    // required = primary/cemented shortage
    // recommended = clinical alternate shortage
    // optional = would improve buffer
  }[]
}
```

---

## 8. Intraday Consumption Tracking

### What Happens During a Surgery Day

As cases complete throughout the day:
1. The sync process detects the case moved to "Completed"
2. Usage items are matched and deducted from `facility_inventory`
3. The coverage engine should re-run for remaining cases that day

### Intraday Alert Logic

After a case completes and implants are deducted:

```
For each component used:
  1. Identify which variant + size was consumed
  2. Recalculate complete sets remaining for that variant
  3. Count remaining cases today that could need this variant
  4. If complete_sets_remaining < remaining_cases:
     → ALERT: "Size {X} {variant} was just used. {N} cases remaining today.
               {M} complete sets remaining. Need {N-M} more to guarantee coverage."
```

### Specific Size Alerts

Even if complete sets are adequate, alert when:
- **Any size drops to 0:** "No size 5 CR PF Left femurs remaining. 2 cases still today."
- **Any size drops to 1 with 2+ cases remaining:** "Last size 5 CR PF Left femur. If next case needs size 5, you're out."

### Alert Priority

- **Critical:** Complete sets < remaining cases (guaranteed gap if unlucky)
- **Warning:** A specific size at 0 or 1 with cases remaining
- **Info:** Coverage adequate but tighter than start of day

---

## 9. Kit Recommendations

### Output Format

The system recommends whole tubs to ship. Each recommendation maps to a physical kit:

```
RECOMMENDATIONS for Memorial Hospital — Tuesday:

REQUIRED (primary/cemented shortages):
  → Send 1 CR Pressfit Left Femur tub
  → Send 1 CR Cemented Left Femur tub
  → Send 1 Tritanium Tibia tub

RECOMMENDED (clinical alternate coverage):
  → Send 1 PS Cemented Left Femur tub
  → Send 1 PS Cemented Right Femur tub
  → Send 1 PS Poly tub

ON HAND (no action needed):
  ✓ CR Pressfit Right Femur — 2 sets (need 1)
  ✓ CS Poly — 4 sets (need 3)
  ✓ Asym Pressfit Patella — 3 sets (need 3)
```

### Kit Name Mapping

Each variant maps to a physical tub name that the rep uses when requesting from the warehouse:

| Variant | Tub Name |
|---------|----------|
| CR Pressfit Left Femur | Left CR Pressfit Femoral Tub |
| CR Cemented Right Femur | Right CR Cemented Femoral Tub |
| Universal Tibia | Universal Tibial Tub |
| Tritanium Tibia | Tritanium Tibial Tub |
| CS Poly | CS Poly Insert Tub |
| PS Poly | PS Poly Insert Tub |
| TS Poly | TS Poly Insert Tub |
| Asym Pressfit Patella | Asymmetric Pressfit Patella Tub |
| Sym Cemented Patella | Symmetric Cemented Patella Tub |
| etc. | |

---

## 10. Edge Cases & Rules

### Rule 1: Mako = Same Implants
Mako TKA and standard TKA use identical implants. Mako THA and standard THA use identical implants. Treat them as the same procedure type for coverage.

### Rule 2: Ambiguous Side
If a case doesn't specify left or right, assume BOTH sides need coverage. This is conservative but prevents gaps.

### Rule 3: Same Surgeon, Mixed Procedures
Dr. Berra has 2 TKAs + 1 THA on the same day. Each procedure type is evaluated independently with its own implant plans. Knee components and hip components don't overlap.

### Rule 4: Shared Inventory Pool
All implants at a facility are available to ALL surgeons. The coverage engine must account for this — you can't earmark sets for specific surgeons.

### Rule 5: Cemented Fallback Doesn't Stack for Already-Cemented Components
If a surgeon's primary plan already uses a cemented tibia (e.g., Universal), the cemented fallback doesn't add MORE Universal tibia sets. The fallback only adds sets for components that CHANGE from pressfit to cemented.

### Rule 6: Poly Variants Can Be Arrays
A surgeon's clinical alternate might specify `poly_variants: ['ps', 'ts']`. This means they want BOTH PS and TS polys available. Each needs its own sets per the formula.

### Rule 7: Consumables (Hip)
Hip heads and screws are used 1 per case (not reusable). The sets needed = cases, period. No sharing across cases.

### Rule 8: Double-Banked Tubs
Some tubs ship with 2 of certain sizes (e.g., common middle sizes). When counting sets from a fresh tub delivery, account for doubles. The `complete_sets` calculation would show 2 for the doubled sizes but 1 for the non-doubled, so min = 1 set. The doubles provide size-collision buffer.

### Rule 9: Multi-Day Awareness
Monday's cases consume inventory. If Dr. Berra operates Monday and Wednesday at the same facility:
- After Monday, some sizes may be missing from sets
- Wednesday's coverage must account for Monday's consumption
- The system should evaluate each day's cases against the PROJECTED inventory after prior days

### Rule 10: Incomplete Sets Are Partial Coverage
If you have 7 out of 8 sizes for a variant, that's 0 complete sets but 87.5% of one set. The system should flag which specific size is missing — the rep might know from experience that the missing size (e.g., size 1 femur) is never used and decide the set is functionally complete.

---

## Appendix: File Map

Key files that implement or relate to this system:

| File | Purpose |
|------|---------|
| `src/lib/preference-config.ts` | Component and variant definitions (needs update for plans) |
| `src/lib/knee-config.ts` | Knee implant grid structure, ref number patterns, sizes |
| `src/lib/hip-config.ts` | Hip implant grid structure |
| `src/lib/inventory-mapper.ts` | Maps ref numbers to grid positions, counts on-hand |
| `src/lib/inventory-check.ts` | Current alert engine (needs rewrite for coverage model) |
| `src/app/(dashboard)/surgeon-preferences/` | Current preference UI (needs redesign for plans) |
| `src/app/api/check-inventory/route.ts` | API endpoint for inventory check |
| `src/app/api/sync-cases/route.ts` | Case sync from RepSuite |
| `src/app/api/morning-digest/route.ts` | Daily digest notification |

### Database Tables

| Table | Purpose |
|-------|---------|
| `facility_inventory` | Scanned implant items at facilities |
| `cases` | Surgical cases synced from RepSuite |
| `case_parts` | Kit parts assigned to cases (loaner tracking) |
| `case_usage_items` | Implants actually used in completed cases |
| `surgeon_preferences` | OLD flat preferences (to be replaced by surgeon_implant_plans) |
| `surgeon_implant_plans` | NEW linked implant plans per surgeon (to be created) |
| `alert_thresholds` | Per-size minimum quantity thresholds |
| `inventory_alerts` | Active shortage alerts |
| `replenishment_requests` | Kit shipment recommendations |
| `notifications` | In-app notification queue |
| `facilities` | Facility list with smart_tracking_enabled flag |
