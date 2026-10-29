-- Migration: security_and_idempotency
-- Date: 2026-03-01
-- Fixes:
--   BUG-001: Expand pin column to store bcrypt hash (VarChar(6) → VarChar(100))
--   BUG-007: Add idempotencyKey column + index to sales table

-- BUG-001: Extend pin column length to hold bcrypt hash (~60 chars)
ALTER TABLE "users" ALTER COLUMN "pin" TYPE VARCHAR(100);

-- BUG-007: Add idempotencyKey to sales for duplicate-request prevention
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(100);
CREATE INDEX IF NOT EXISTS "sales_idempotencyKey_idx" ON "sales"("idempotencyKey");

-- NOTE: Existing plain-text PINs will be invalidated by this change.
-- After deploying, run: NODE_ENV=development npx ts-node scripts/set-test-pin.ts
-- (or your equivalent script that now bcrypt-hashes the PIN before writing)
-- All users will need their PINs re-set via the admin panel.
