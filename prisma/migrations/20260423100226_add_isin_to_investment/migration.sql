-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "isin" TEXT;

-- CreateIndex
CREATE INDEX "Investment_userId_isin_idx" ON "Investment"("userId", "isin");
