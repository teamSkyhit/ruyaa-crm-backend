-- CreateEnum
CREATE TYPE "CounterType" AS ENUM ('FLOOR', 'BILLING');

-- AlterTable
ALTER TABLE "counters" ADD COLUMN     "counterType" "CounterType" NOT NULL DEFAULT 'BILLING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pin" VARCHAR(6);

-- CreateIndex
CREATE INDEX "counters_counterType_idx" ON "counters"("counterType");
