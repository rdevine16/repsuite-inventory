-- Add 'dismissed' to the allowed values for case_usage_items.current_status
-- Used by the discrepancy dismiss feature on the Inventory Intelligence Dashboard

ALTER TABLE case_usage_items DROP CONSTRAINT case_usage_items_current_status_check;
ALTER TABLE case_usage_items ADD CONSTRAINT case_usage_items_current_status_check
  CHECK (current_status = ANY (ARRAY['deducted', 'not_matched', 'restored', 'dismissed']));
