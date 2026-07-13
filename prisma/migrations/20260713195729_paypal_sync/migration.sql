-- CreateEnum
CREATE TYPE "PayPalTxnStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "lastPaymentFailedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PayPalTransaction" (
    "id" TEXT NOT NULL,
    "paypalTransactionId" TEXT NOT NULL,
    "payerEmail" TEXT,
    "payerName" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "subscriptionId" TEXT,
    "status" "PayPalTxnStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedMemberId" TEXT,
    "dismissReason" TEXT,
    "source" TEXT NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayPalTransaction_paypalTransactionId_key" ON "PayPalTransaction"("paypalTransactionId");

-- CreateIndex
CREATE INDEX "PayPalTransaction_status_idx" ON "PayPalTransaction"("status");

-- AddForeignKey
ALTER TABLE "PayPalTransaction" ADD CONSTRAINT "PayPalTransaction_matchedMemberId_fkey" FOREIGN KEY ("matchedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
