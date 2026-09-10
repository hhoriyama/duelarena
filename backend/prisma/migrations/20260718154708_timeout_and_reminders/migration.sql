-- AlterEnum
ALTER TYPE "OutboxType" ADD VALUE 'MATCH_REMINDER';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "reminder10SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder5SentAt" TIMESTAMP(3);
