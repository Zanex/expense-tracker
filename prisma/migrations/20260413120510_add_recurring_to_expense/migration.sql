-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringEndDate" TIMESTAMP(3),
ADD COLUMN     "recurringFrequency" TEXT,
ADD COLUMN     "recurringParentId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");

-- CreateIndex
CREATE INDEX "Expense_userId_isRecurring_idx" ON "Expense"("userId", "isRecurring");
