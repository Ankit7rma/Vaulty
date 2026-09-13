-- CreateTable
CREATE TABLE "VaultItemHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cipher" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItemHistory_itemId_savedAt_idx" ON "VaultItemHistory"("itemId", "savedAt");

-- AddForeignKey
ALTER TABLE "VaultItemHistory" ADD CONSTRAINT "VaultItemHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
