-- CreateEnum
CREATE TYPE "SharedVaultRole" AS ENUM ('owner', 'editor', 'reader');

-- CreateTable
CREATE TABLE "SharedVault" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameIv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVaultMembership" (
    "id" TEXT NOT NULL,
    "sharedVaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SharedVaultRole" NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedVaultMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVaultInvite" (
    "id" TEXT NOT NULL,
    "sharedVaultId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SharedVaultRole" NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedVaultInvite_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VaultItem" ADD COLUMN "sharedVaultId" TEXT;

-- CreateIndex
CREATE INDEX "SharedVault_ownerId_idx" ON "SharedVault"("ownerId");
CREATE UNIQUE INDEX "SharedVaultMembership_sharedVaultId_userId_key" ON "SharedVaultMembership"("sharedVaultId", "userId");
CREATE INDEX "SharedVaultMembership_userId_idx" ON "SharedVaultMembership"("userId");
CREATE UNIQUE INDEX "SharedVaultInvite_sharedVaultId_email_key" ON "SharedVaultInvite"("sharedVaultId", "email");
CREATE INDEX "SharedVaultInvite_email_idx" ON "SharedVaultInvite"("email");
CREATE INDEX "SharedVaultInvite_expiresAt_idx" ON "SharedVaultInvite"("expiresAt");
CREATE INDEX "VaultItem_sharedVaultId_idx" ON "VaultItem"("sharedVaultId");

-- AddForeignKey
ALTER TABLE "SharedVault" ADD CONSTRAINT "SharedVault_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultMembership" ADD CONSTRAINT "SharedVaultMembership_sharedVaultId_fkey" FOREIGN KEY ("sharedVaultId") REFERENCES "SharedVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultMembership" ADD CONSTRAINT "SharedVaultMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultInvite" ADD CONSTRAINT "SharedVaultInvite_sharedVaultId_fkey" FOREIGN KEY ("sharedVaultId") REFERENCES "SharedVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultInvite" ADD CONSTRAINT "SharedVaultInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_sharedVaultId_fkey" FOREIGN KEY ("sharedVaultId") REFERENCES "SharedVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
