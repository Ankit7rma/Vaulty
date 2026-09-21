-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "publicKey" TEXT,
    ADD COLUMN "wrappedPrivateKey" TEXT,
    ADD COLUMN "wrappedPrivateKeyIv" TEXT,
    ADD COLUMN "keypairAlg" TEXT;
