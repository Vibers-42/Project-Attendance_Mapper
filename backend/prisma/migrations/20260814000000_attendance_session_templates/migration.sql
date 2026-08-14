-- Superadmin-only session templates: a template is an AttendanceSession created
-- without a room. Faculty "join" a template to instantiate their own room-scoped
-- session, which is traced back to the template via templateSessionId.
-- Purely additive — no existing rows are altered (isTemplate defaults to false,
-- templateSessionId defaults to null for every existing session).

ALTER TABLE "AttendanceSession" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceSession" ADD COLUMN "templateSessionId" TEXT;

ALTER TABLE "AttendanceSession"
  ADD CONSTRAINT "AttendanceSession_templateSessionId_fkey"
  FOREIGN KEY ("templateSessionId") REFERENCES "AttendanceSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AttendanceSession_isTemplate_status_idx" ON "AttendanceSession"("isTemplate", "status");
CREATE INDEX "AttendanceSession_templateSessionId_idx" ON "AttendanceSession"("templateSessionId");
