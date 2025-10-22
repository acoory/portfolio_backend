-- CreateTable
CREATE TABLE "post_viewed" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerIp" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_viewed_postId_idx" ON "post_viewed"("postId");

-- CreateIndex
CREATE INDEX "post_viewed_viewerIp_idx" ON "post_viewed"("viewerIp");

-- AddForeignKey
ALTER TABLE "post_viewed" ADD CONSTRAINT "post_viewed_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
