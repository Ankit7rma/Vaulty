-- CreateTable
CREATE TABLE "SharedVaultInviteLink" (
    "id" TEXT NOT NULL,
    "sharedVaultId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "SharedVaultRole" NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SharedVaultInviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedVaultPendingWrap" (
    "id" TEXT NOT NULL,
    "sharedVaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SharedVaultRole" NOT NULL,
    "sourceLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedVaultPendingWrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedVaultInviteLink_token_key" ON "SharedVaultInviteLink"("token");
CREATE INDEX "SharedVaultInviteLink_sharedVaultId_idx" ON "SharedVaultInviteLink"("sharedVaultId");
CREATE INDEX "SharedVaultInviteLink_expiresAt_idx" ON "SharedVaultInviteLink"("expiresAt");
CREATE UNIQUE INDEX "SharedVaultPendingWrap_sharedVaultId_userId_key" ON "SharedVaultPendingWrap"("sharedVaultId", "userId");
CREATE INDEX "SharedVaultPendingWrap_userId_idx" ON "SharedVaultPendingWrap"("userId");

-- AddForeignKey
ALTER TABLE "SharedVaultInviteLink" ADD CONSTRAINT "SharedVaultInviteLink_sharedVaultId_fkey" FOREIGN KEY ("sharedVaultId") REFERENCES "SharedVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultInviteLink" ADD CONSTRAINT "SharedVaultInviteLink_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultPendingWrap" ADD CONSTRAINT "SharedVaultPendingWrap_sharedVaultId_fkey" FOREIGN KEY ("sharedVaultId") REFERENCES "SharedVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultPendingWrap" ADD CONSTRAINT "SharedVaultPendingWrap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedVaultPendingWrap" ADD CONSTRAINT "SharedVaultPendingWrap_sourceLinkId_fkey" FOREIGN KEY ("sourceLinkId") REFERENCES "SharedVaultInviteLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
