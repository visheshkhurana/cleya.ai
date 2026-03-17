-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "message_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "messageSid" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_records_userId_idx" ON "message_records"("userId");
CREATE INDEX "message_records_channel_idx" ON "message_records"("channel");
CREATE INDEX "message_records_status_idx" ON "message_records"("status");
CREATE INDEX "message_records_createdAt_idx" ON "message_records"("createdAt");

-- AddForeignKey
ALTER TABLE "message_records" ADD CONSTRAINT "message_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
