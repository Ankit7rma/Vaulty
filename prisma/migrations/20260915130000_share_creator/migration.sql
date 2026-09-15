-- AlterTable
ALTER TABLE "Share" ADD COLUMN "createdBy" TEXT;

-- CreateIndex
CREATE INDEX "Share_createdBy_createdAt_idx" ON "Share"("createdBy", "createdAt");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
