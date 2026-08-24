-- =====================================================
-- Amazon Clone Database
-- Migration: 004 - Fix Order Item Unit Reuse
-- Description:
-- Removes the constraint that incorrectly prevents
-- a physical product unit from appearing in multiple
-- historical orders over its lifetime.
-- =====================================================

BEGIN;

DROP INDEX IF EXISTS order_item_unit_unique_idx;

COMMIT;