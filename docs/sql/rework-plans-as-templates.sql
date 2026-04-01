-- Rework: Plans as reusable templates assigned to cases
-- Run in Supabase SQL Editor

-- Drop the old table and recreate as a template library
DROP TABLE IF EXISTS surgeon_implant_plans;

CREATE TABLE surgeon_implant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_name TEXT NOT NULL,
  plan_name TEXT NOT NULL,                -- "CR Pressfit Knee", "PS Pro Knee", "Primary Hip"
  procedure_type TEXT NOT NULL,           -- 'knee' or 'hip'
  is_default BOOLEAN DEFAULT false,       -- Auto-assign to new cases for this surgeon+procedure_type

  -- Primary plan components
  femur_variant TEXT,
  tibia_variant TEXT,
  patella_variant TEXT,
  poly_variants TEXT[] DEFAULT '{}',

  -- Cemented fallback (1:1 with primary — any case could need cementing)
  cemented_femur_variant TEXT,            -- NULL if primary is already cemented
  cemented_tibia_variant TEXT,
  cemented_patella_variant TEXT,

  -- Clinical alternate (different constraint system)
  has_clinical_alternate BOOLEAN DEFAULT false,
  alt_femur_variant TEXT,
  alt_tibia_variant TEXT,
  alt_patella_variant TEXT,
  alt_poly_variants TEXT[] DEFAULT '{}',
  alt_conversion_likelihood TEXT,         -- 'low', 'medium', 'high'

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_procedure CHECK (procedure_type IN ('knee', 'hip')),
  CONSTRAINT valid_alt_conversion CHECK (
    (has_clinical_alternate = false AND alt_conversion_likelihood IS NULL) OR
    (has_clinical_alternate = true AND alt_conversion_likelihood IN ('low', 'medium', 'high'))
  )
);

-- Enable RLS
ALTER TABLE surgeon_implant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_plans" ON surgeon_implant_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_plans" ON surgeon_implant_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_plans" ON surgeon_implant_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_plans" ON surgeon_implant_plans FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_plans_surgeon ON surgeon_implant_plans(surgeon_name);
CREATE INDEX idx_plans_default ON surgeon_implant_plans(surgeon_name, procedure_type) WHERE is_default = true;

-- Add plan_id to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES surgeon_implant_plans(id) ON DELETE SET NULL;

CREATE INDEX idx_cases_plan ON cases(plan_id) WHERE plan_id IS NOT NULL;
