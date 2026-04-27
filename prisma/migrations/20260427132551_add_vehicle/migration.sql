-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "vehicleId" TEXT;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "fuelType" TEXT NOT NULL DEFAULT 'gasoline',
    "initialKm" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRefuel" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DECIMAL(8,2) NOT NULL,
    "pricePerLiter" DECIMAL(6,4) NOT NULL,
    "totalCost" DECIMAL(8,2) NOT NULL,
    "kmAtRefuel" INTEGER NOT NULL,
    "fullTank" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleRefuel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle"("userId");

-- CreateIndex
CREATE INDEX "VehicleRefuel_vehicleId_date_idx" ON "VehicleRefuel"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleRefuel_userId_date_idx" ON "VehicleRefuel"("userId", "date");

-- CreateIndex
CREATE INDEX "Expense_userId_vehicleId_idx" ON "Expense"("userId", "vehicleId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRefuel" ADD CONSTRAINT "VehicleRefuel_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
