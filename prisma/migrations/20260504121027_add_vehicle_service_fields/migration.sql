-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "lastServiceDate" TIMESTAMP(3),
ADD COLUMN     "lastServiceKm" INTEGER,
ADD COLUMN     "serviceIntervalKm" INTEGER;
