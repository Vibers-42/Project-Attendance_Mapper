-- Add conductedById to track which faculty member is currently conducting a live session.
-- This enables live-session locking: only the faculty who started the session can access
-- the scanner while it is ACTIVE.

ALTER TABLE "PlacementSession" ADD COLUMN "conductedById" TEXT;

ALTER TABLE "PlacementSession"
  ADD CONSTRAINT "PlacementSession_conductedById_fkey"
  FOREIGN KEY ("conductedById") REFERENCES "Faculty"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PlacementSession_conductedById_idx" ON "PlacementSession"("conductedById");
