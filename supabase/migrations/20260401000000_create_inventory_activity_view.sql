-- Inventory Activity View
-- Unifies add and remove events into a single chronological feed
-- Used by the Inventory Intelligence Dashboard activity tab

CREATE OR REPLACE VIEW inventory_activity AS

-- Add events: items currently in inventory
SELECT
  fi.id AS event_id,
  'add' AS event_type,
  fi.added_at AS event_at,
  fi.facility_id,
  fi.reference_number,
  fi.description,
  fi.lot_number,
  fi.expiration_date,
  fi.gtin,
  NULL::uuid AS case_id,
  NULL::text AS case_display_id,
  NULL::text AS surgeon_name,
  NULL::text AS procedure_name,
  NULL::timestamptz AS surgery_date,
  NULL::boolean AS auto_deducted,
  NULL::boolean AS manually_overridden,
  NULL::boolean AS source_conflict,
  NULL::text AS current_status,
  NULL::uuid AS case_usage_item_id
FROM facility_inventory fi

UNION ALL

-- Remove events: items deducted from inventory (with case linkage)
SELECT
  ui.id AS event_id,
  CASE
    WHEN ui.restored_at IS NOT NULL THEN 'restore'
    ELSE 'remove'
  END AS event_type,
  ui.created_at AS event_at,
  ui.facility_id,
  ui.reference_number,
  ui.description,
  ui.lot_number,
  ui.expiration_date,
  ui.gtin,
  c.id AS case_id,
  c.case_id AS case_display_id,
  c.surgeon_name,
  c.procedure_name,
  c.surgery_date,
  cui.auto_deducted,
  cui.manually_overridden,
  cui.source_conflict,
  cui.current_status,
  cui.id AS case_usage_item_id
FROM used_items ui
LEFT JOIN case_usage_items cui ON cui.id = ui.case_usage_item_id
LEFT JOIN cases c ON c.id = cui.case_id;

-- Add comment for documentation
COMMENT ON VIEW inventory_activity IS 'Unified inventory activity feed combining add events (facility_inventory) and remove/restore events (used_items with case linkage). Used by the Inventory Intelligence Dashboard.';
