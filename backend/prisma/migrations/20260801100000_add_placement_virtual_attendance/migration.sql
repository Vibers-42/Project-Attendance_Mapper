-- AlterTable: add virtual-attendance columns to PlacementStudent
ALTER TABLE "PlacementStudent" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "PlacementStudent" ADD COLUMN "markedAt" TIMESTAMP(3);
