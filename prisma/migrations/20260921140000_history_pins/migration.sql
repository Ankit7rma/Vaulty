-- AlterTable
ALTER TABLE "VaultItemHistory"
    ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "label" TEXT,
    ADD COLUMN "labelIv" TEXT;
