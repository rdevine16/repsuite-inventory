-- Create surgeon_implant_plans table
-- Replaces flat surgeon_preferences with linked implant plans per surgeon
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS surgeon_implant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_name TEXT NOT NULL,
  procedure_type TEXT NOT NULL,          -- 'knee', 'hip'
  plan_type TEXT NOT NULL,               -- 'primary', 'cemented_fallback', 'clinical_alternate'
  plan_label TEXT,                       -- Display name: "CR Pressfit", "CR Cemented", "PS Backup"
  conversion_likelihood TEXT,            -- NULL for primary/cemented, 'low'/'medium'/'high' for clinical_alternate
  femur_variant TEXT,                    -- e.g., 'cr_pressfit', 'ps_cemented'
  tibia_variant TEXT,                    -- e.g., 'tritanium', 'universal', 'primary'
  patella_variant TEXT,                  -- e.g., 'asym_pressfit', 'sym_cemented'
  poly_variants TEXT[] DEFAULT '{}',     -- Array: ['cs'] or ['ps', 'ts']
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_plan_type CHECK (plan_type IN ('primary', 'cemented_fallback', 'clinical_alternate')),
  CONSTRAINT valid_conversion CHECK (
    (plan_type != 'clinical_alternate' AND conversion_likelihood IS NULL) OR
    (plan_type = 'clinical_alternate' AND conversion_likelihood IN ('low', 'medium', 'high'))
  ),
  UNIQUE(surgeon_name, procedure_type, plan_type)
);

-- Enable RLS
ALTER TABLE surgeon_implant_plans ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write
CREATE POLICY "Authenticated users can read surgeon_implant_plans"
  ON surgeon_implant_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert surgeon_implant_plans"
  ON surgeon_implant_plans FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update surgeon_implant_plans"
  ON surgeon_implant_plans FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete surgeon_implant_plans"
  ON surgeon_implant_plans FOR DELETE TO authenticated USING (true);

-- Index for lookups
CREATE INDEX idx_implant_plans_surgeon ON surgeon_implant_plans(surgeon_name, procedure_type);
