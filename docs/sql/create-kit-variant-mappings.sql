-- Kit variant mappings: maps RepSuite set names to implant component/variant
-- This tells the coverage engine what each tub satisfies
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS kit_variant_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_name TEXT NOT NULL,                   -- RepSuite set name (e.g., "Rgt CR PA Femurs Sz 1-8")
  component TEXT,                           -- 'femur', 'tibia', 'patella', 'poly', 'stem', 'cup', 'liner', 'head', or NULL for instruments
  variant TEXT,                             -- 'cr_pressfit', 'cs', 'tritanium', etc.
  side TEXT,                                -- 'left', 'right', or NULL (for non-side-specific)
  tub_group TEXT,                           -- Group ID for tubs that must pair together (e.g., 'cs_poly', 'ts_poly')
  tubs_in_group INT DEFAULT 1,              -- How many tubs make 1 complete set in this group
  is_implant BOOLEAN DEFAULT true,          -- false for instrument trays/sets
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(set_name)
);

-- Enable RLS
ALTER TABLE kit_variant_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_kit_variants" ON kit_variant_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_kit_variants" ON kit_variant_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_kit_variants" ON kit_variant_mappings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_kit_variants" ON kit_variant_mappings FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_kit_variant_component ON kit_variant_mappings(component, variant) WHERE is_implant = true;
CREATE INDEX idx_kit_variant_group ON kit_variant_mappings(tub_group) WHERE tub_group IS NOT NULL;

-- Pre-populate known mappings

-- Knee Femurs
INSERT INTO kit_variant_mappings (set_name, component, variant, side) VALUES
  ('Rgt CR Femurs Sz 1-8', 'femur', 'cr_cemented', 'right'),
  ('Lft CR Femurs Sz 1-8', 'femur', 'cr_cemented', 'left'),
  ('Rgt CR PA Femurs Sz 1-8', 'femur', 'cr_pressfit', 'right'),
  ('Lft CR PA Femurs Sz 1-8', 'femur', 'cr_pressfit', 'left'),
  ('Rgt PS Femurs Sz 1-8', 'femur', 'ps_cemented', 'right'),
  ('Lft PS Femurs Sz 1-8', 'femur', 'ps_cemented', 'left'),
  ('Rgt PS PA Femurs Sz 1-8', 'femur', 'ps_pressfit', 'right')
ON CONFLICT (set_name) DO NOTHING;

-- Knee Tibias
INSERT INTO kit_variant_mappings (set_name, component, variant) VALUES
  ('Tritanium Baseplates Sz 1-8', 'tibia', 'tritanium'),
  ('K Triath Univ Sz 1-8 (5521-B)', 'tibia', 'universal'),
  ('Universal Baseplates Sz 1-8', 'tibia', 'universal')
ON CONFLICT (set_name) DO NOTHING;

-- Knee Patellas
INSERT INTO kit_variant_mappings (set_name, component, variant) VALUES
  ('Tritanium Asymmetric Patellas', 'patella', 'asym_pressfit'),
  ('Asymmetric Patellas X3', 'patella', 'asym_cemented'),
  ('Symmetric Patellas X3', 'patella', 'sym_cemented')
ON CONFLICT (set_name) DO NOTHING;

-- Knee Polys — CS (2 tubs = 1 complete set)
INSERT INTO kit_variant_mappings (set_name, component, variant, tub_group, tubs_in_group) VALUES
  ('CS X3 Inserts Sz 1-8', 'poly', 'cs', 'cs_poly', 2),
  ('CS X3 Inserts (10 12 14mm Sz 1-8)', 'poly', 'cs', 'cs_poly', 2)
ON CONFLICT (set_name) DO NOTHING;

-- Knee Polys — PS (2 tubs = 1 complete set)
INSERT INTO kit_variant_mappings (set_name, component, variant, tub_group, tubs_in_group) VALUES
  ('PS X3 Inserts Sz 1-8', 'poly', 'ps', 'ps_poly', 2),
  ('PS X3 Inserts (10 12 14mm Sz 1-8)', 'poly', 'ps', 'ps_poly', 2)
ON CONFLICT (set_name) DO NOTHING;

-- Knee Polys — TS (2 tubs = 1 complete set)
INSERT INTO kit_variant_mappings (set_name, component, variant, tub_group, tubs_in_group) VALUES
  ('Tri TS Inserts Only Sz 1-4', 'poly', 'ts', 'ts_poly', 2),
  ('Tri TS Inserts Only Sz 5-8', 'poly', 'ts', 'ts_poly', 2)
ON CONFLICT (set_name) DO NOTHING;

-- Instrument sets (not implants — coverage engine skips these)
INSERT INTO kit_variant_mappings (set_name, is_implant, notes) VALUES
  ('CR BASIC SET (5 TRAYS)', false, 'Instrument set'),
  ('CR (PREP ONLY) SET (2 TRAYS)', false, 'Instrument set'),
  ('PS BASIC SET (5 TRAYS)', false, 'Instrument set'),
  ('PS (PREP ONLY) SET (2 TRAYS)', false, 'Instrument set'),
  ('MIS CR BASIC SET (5 TRAYS)', false, 'Instrument set'),
  ('Tritanium Prep Tray', false, 'Instrument set'),
  ('Tritanium Window Trial Tray', false, 'Instrument set'),
  ('ACCOLADE II TRAY SET', false, 'Instrument set'),
  ('Acetabular Reamers', false, 'Instrument set'),
  ('TRIDENT II GENERAL TRAY', false, 'Instrument set'),
  ('Trident II Core Trials Tray', false, 'Instrument set'),
  ('MDM Instrument Tray', false, 'Instrument set'),
  ('Dr Berra Hip Tray', false, 'Instrument set'),
  ('Dr Berra Knee Tray', false, 'Instrument set'),
  ('Dr Hanson Knee Tray', false, 'Instrument set'),
  ('Tri CS 1 - 8 Trial Tray', false, 'Trial tray'),
  ('CS Trial Tray (10, 12, 14mm) Sz 1-8', false, 'Trial tray'),
  ('PS Trial Tray (10, 12, 14mm) Sz 1-8', false, 'Trial tray'),
  ('Tri Difficult Primary Tray', false, 'Instrument set'),
  ('Triathlon Pro CR/PS Set', false, 'Instrument set'),
  ('H INSIGNIA BROACH TRAY', false, 'Instrument set'),
  ('H INSIGNIA FEMORAL TRAY', false, 'Instrument set'),
  ('Direct Anterior Cup Tray', false, 'Instrument set'),
  ('DIRECT ANTERIOR RETRACTORS', false, 'Instrument set'),
  ('C-Taper HEAD TRIALS 22mm-36mm', false, 'Trial set'),
  ('Accolade C Tray', false, 'Instrument set'),
  ('Acetabular Wedge Trial Tray', false, 'Trial tray')
ON CONFLICT (set_name) DO NOTHING;

-- Hip implants
INSERT INTO kit_variant_mappings (set_name, component, variant) VALUES
  ('H INSIGNIA HIP STEM - SZ 1-10 (7000)', 'stem', 'insignia_standard'),
  ('Accolade II 127 Degree', 'stem', 'accolade_ii_127'),
  ('Accolade II 127 Degree Stems', 'stem', 'accolade_ii_127'),
  ('Accolade II 132 Degree', 'stem', 'accolade_ii_132'),
  ('Accolade II 132 Degree Stems', 'stem', 'accolade_ii_132'),
  ('Accolade II 127 and 132 Degree (2 Tubs)', 'stem', 'accolade_ii_127'),
  ('Accolade C 127/132 w/Centralizers', 'stem', 'accolade_c_127'),
  ('Trident II Tritanium Cluster Cups w/Screws', 'cup', 'trident_ii_tritanium'),
  ('Trident II Tritanium Cluster Cups (Max)', 'cup', 'trident_ii_tritanium'),
  ('TRIDENT II TRITANIUM MULTIHOLE CUPS W/SCREWS', 'cup', 'trident_ii_tritanium'),
  ('Trident II Tritanium PSL Clusters HAj w/Screws', 'cup', 'trident_psl_ha'),
  ('28/32/36MM 0/DEG X3 Insert', 'liner', 'x3_0'),
  ('28/32/36MM 10/DEG X3 Insert', 'liner', 'x3_10'),
  ('28MM-36MM 0&10DEG Eccentric X3 Insert', 'liner', 'x3_ecc'),
  ('40MM/44MM 0DEG X3 Insert', 'liner', 'x3_0'),
  ('MDM Dual Mobility Cups (w/Inserts)', 'liner', 'mdm_cocr'),
  ('0 DEG Constrained Trident Liners', 'liner', 'x3_0'),
  ('10 DEG Constrained Trident Liners', 'liner', 'x3_10'),
  ('28MM-44MM V40 Biolox Heads', 'head', 'delta_ceramic'),
  ('28MM-44MM C-Taper Biolox Heads', 'head', 'delta_ceramic'),
  ('28MM-36MM V40 LFIT Heads', 'head', 'v40_cocr'),
  ('28MM-36MM C-Taper LFIT Heads', 'head', 'v40_cocr'),
  ('40MM-44MM V40 LFIT Heads', 'head', 'v40_cocr'),
  ('40MM/44MM C-Taper LFIT Heads', 'head', 'v40_cocr')
ON CONFLICT (set_name) DO NOTHING;
