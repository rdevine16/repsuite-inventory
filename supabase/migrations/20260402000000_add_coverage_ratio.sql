-- Coverage ratio: the fraction of cases a rep targets to fully cover with implant sets.
-- Default 0.66 means "send enough sets for 2 out of 3 cases" — intentional under-ordering.
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS coverage_ratio NUMERIC(3,2) DEFAULT 0.66;
