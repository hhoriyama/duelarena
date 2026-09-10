-- CreateEnum
CREATE TYPE "QueueSource" AS ENUM ('WEB', 'DISCORD');

-- CreateEnum
CREATE TYPE "OutboxType" AS ENUM ('MATCH_FOUND', 'MATCH_STARTED', 'REPORT_RECEIVED', 'RESULT_CONFIRMED', 'MATCH_CANCELLED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "discordTextChannelId" TEXT;

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "source" "QueueSource" NOT NULL DEFAULT 'WEB',
ALTER COLUMN "socketId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BotOutbox" (
    "id" TEXT NOT NULL,
    "type" "OutboxType" NOT NULL,
    "matchId" TEXT,
    "payload" JSONB NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "BotOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotOutbox_delivered_createdAt_idx" ON "BotOutbox"("delivered", "createdAt");
