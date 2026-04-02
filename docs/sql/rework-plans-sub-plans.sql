-- Rework: Plans with sub-plans and individual items
-- A template has sub-plans (Plan A, B, C), each sub-plan has items
-- Items only appear in one sub-plan — no duplication needed
-- Run in Supabase SQL Editor

-- Drop the old monolithic table
DROP TABLE IF EXISTS surgeon_implant_plans CASCADE;

-- Template: the named plan assigned to cases (e.g., "Primary Knee")
CREATE TABLE surgeon_implant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_name TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  procedure_type TEXT NOT NULL CHECK (procedure_type IN ('knee', 'hip')),
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE surgeon_implant_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_plans" ON surgeon_implant_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_plans_surgeon ON surgeon_implant_plans(surgeon_name);
CREATE INDEX idx_plans_default ON surgeon_implant_plans(surgeon_name, procedure_type) WHERE is_default = true;

-- Sub-plans within a template (Plan A, Plan B, Plan C)
CREATE TABLE plan_sub_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES surgeon_implant_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                       -- "CR Pressfit", "CR Cemented", "PS Backup"
  frequency TEXT NOT NULL DEFAULT 'every_case',  -- 'every_case', 'low', 'medium', 'high'
  sort_order INT DEFAULT 0,                 -- Display order (A=0, B=1, C=2)
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_frequency CHECK (frequency IN ('every_case', 'low', 'medium', 'high'))
);

ALTER TABLE plan_sub_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_sub_plans" ON plan_sub_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_sub_plans_template ON plan_sub_plans(template_id);

-- Individual items in a sub-plan
CREATE TABLE plan_sub_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_plan_id UUID NOT NULL REFERENCES plan_sub_plans(id) ON DELETE CASCADE,
  component TEXT NOT NULL,                  -- 'femur', 'tibia', 'patella', 'poly', 'stem', etc.
  variant TEXT NOT NULL,                    -- 'cr_pressfit', 'universal', 'cs', etc.
  side TEXT,                                -- 'left', 'right', or NULL
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(sub_plan_id, component, variant, side)
);

ALTER TABLE plan_sub_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_items" ON plan_sub_plan_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_items_sub_plan ON plan_sub_plan_items(sub_plan_id);

-- Re-add plan_id on cases (cascade set null if plan deleted)
-- Column already exists from previous migration, just ensure FK is correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE cases ADD COLUMN plan_id UUID REFERENCES surgeon_implant_plans(id) ON DELETE SET NULL;
    CREATE INDEX idx_cases_plan ON cases(plan_id) WHERE plan_id IS NOT NULL;
  END IF;
END $$;
