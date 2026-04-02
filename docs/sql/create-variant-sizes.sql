-- Variant sizes: defines what sizes constitute a "complete set" for each component/variant
-- Used by the coverage engine to count complete sets in facility inventory
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS variant_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT NOT NULL,          -- 'femur', 'tibia', 'cup', 'stem', etc.
  variant TEXT NOT NULL,            -- 'cr_pressfit', 'trident_ii_tritanium', etc.
  sizes TEXT[] NOT NULL,            -- ['1','2','3','4','5','6','7','8'] or ['46C','48D',...]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(component, variant)
);

ALTER TABLE variant_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_variant_sizes" ON variant_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Pre-populate knee sizes (universal across all variants)
INSERT INTO variant_sizes (component, variant, sizes) VALUES
  -- Femurs: all 8 sizes
  ('femur', 'cr_pressfit', ARRAY['1','2','3','4','5','6','7','8']),
  ('femur', 'cr_cemented', ARRAY['1','2','3','4','5','6','7','8']),
  ('femur', 'ps_pressfit', ARRAY['1','2','3','4','5','6','7','8']),
  ('femur', 'ps_cemented', ARRAY['1','2','3','4','5','6','7','8']),
  ('femur', 'ps_pro_cemented', ARRAY['1','2','3','4','5','6','7','8']),
  -- Tibias: all 8 sizes
  ('tibia', 'tritanium', ARRAY['1','2','3','4','5','6','7','8']),
  ('tibia', 'primary', ARRAY['1','2','3','4','5','6','7','8']),
  ('tibia', 'universal', ARRAY['1','2','3','4','5','6','7','8']),
  ('tibia', 'mis', ARRAY['1','2','3','4','5','6','7','8']),
  -- Patellas: variant-specific sizes
  ('patella', 'asym_pressfit', ARRAY['29','32','35','38','40']),
  ('patella', 'asym_cemented', ARRAY['29','32','35','38','40']),
  ('patella', 'sym_pressfit', ARRAY['29','31','33','36','39']),
  ('patella', 'sym_cemented', ARRAY['27','29','31','33','36','39']),
  -- Polys: knee sizes 1-8 (thicknesses handled separately)
  ('poly', 'cs', ARRAY['1','2','3','4','5','6','7','8']),
  ('poly', 'ps', ARRAY['1','2','3','4','5','6','7','8']),
  ('poly', 'ts', ARRAY['1','2','3','4','5','6','7','8'])
ON CONFLICT (component, variant) DO NOTHING;

-- Hip sizes
INSERT INTO variant_sizes (component, variant, sizes) VALUES
  -- Cups
  ('cup', 'trident_ii_tritanium', ARRAY['46C','48D','50D','52E','54E','56F','58F','60G','62G']),
  ('cup', 'trident_psl_ha', ARRAY['46D','50E','52E']),
  -- Stems: full range
  ('stem', 'accolade_ii_132', ARRAY['0','1','2','3','4','5','6','7','8','9','10','11']),
  ('stem', 'accolade_ii_127', ARRAY['0','1','2','3','4','5','6','7','8','9','10','11']),
  ('stem', 'accolade_c_132', ARRAY['2','3','4','5','6','7']),
  ('stem', 'accolade_c_127', ARRAY['2','3','4','5','6','7']),
  ('stem', 'insignia_standard', ARRAY['1','2','3','4','5','6','7','8','9','10']),
  ('stem', 'insignia_high', ARRAY['1','2','3','4','5','6','7','8','9','10'])
ON CONFLICT (component, variant) DO NOTHING;

-- Liners, heads — left empty for user to define via UI after scanning
