-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('NORMAL', 'EVENT');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "mode" "MatchMode" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "mode" "MatchMode" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
