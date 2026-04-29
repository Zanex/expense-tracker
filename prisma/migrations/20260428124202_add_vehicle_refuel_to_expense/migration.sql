/*
  Warnings:

  - You are about to drop the `VehicleRefuel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VehicleRefuel" DROP CONSTRAINT "VehicleRefuel_vehicleId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "fullTank" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kmAtRefuel" INTEGER,
ADD COLUMN     "liters" DECIMAL(8,2);

-- DropTable
DROP TABLE "VehicleRefuel";
