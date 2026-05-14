-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "player1Accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "player2Accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportedAt" TIMESTAMP(3);
