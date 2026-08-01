-- CreateEnum
CREATE TYPE "PlacementSessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlacementAttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "PlacementPermissionRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "PlacementSession" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "date"        TIMESTAMP(3) NOT NULL,
    "venue"       TEXT,
    "description" TEXT,
    "status"      "PlacementSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementStudent" (
    "id"               TEXT NOT NULL,
    "rollNumber"       TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "sessionId"        TEXT NOT NULL,
    "attendanceStatus" "PlacementAttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementSessionPermission" (
    "id"        TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "role"      "PlacementPermissionRole" NOT NULL DEFAULT 'VIEWER',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementSessionPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementSession_createdById_idx" ON "PlacementSession"("createdById");

-- CreateIndex
CREATE INDEX "PlacementSession_status_idx" ON "PlacementSession"("status");

-- CreateIndex
CREATE INDEX "PlacementSession_date_idx" ON "PlacementSession"("date");

-- CreateIndex
CREATE INDEX "PlacementSession_status_date_idx" ON "PlacementSession"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementStudent_sessionId_rollNumber_key" ON "PlacementStudent"("sessionId", "rollNumber");

-- CreateIndex
CREATE INDEX "PlacementStudent_sessionId_idx" ON "PlacementStudent"("sessionId");

-- CreateIndex
CREATE INDEX "PlacementStudent_sessionId_attendanceStatus_idx" ON "PlacementStudent"("sessionId", "attendanceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSessionPermission_sessionId_facultyId_key" ON "PlacementSessionPermission"("sessionId", "facultyId");

-- CreateIndex
CREATE INDEX "PlacementSessionPermission_sessionId_idx" ON "PlacementSessionPermission"("sessionId");

-- CreateIndex
CREATE INDEX "PlacementSessionPermission_facultyId_idx" ON "PlacementSessionPermission"("facultyId");

-- AddForeignKey
ALTER TABLE "PlacementSession" ADD CONSTRAINT "PlacementSession_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementStudent" ADD CONSTRAINT "PlacementStudent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "PlacementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementSessionPermission" ADD CONSTRAINT "PlacementSessionPermission_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "PlacementSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementSessionPermission" ADD CONSTRAINT "PlacementSessionPermission_facultyId_fkey"
    FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
