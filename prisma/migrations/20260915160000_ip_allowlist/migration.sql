-- AlterTable
ALTER TABLE "User" ADD COLUMN "ipAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];
