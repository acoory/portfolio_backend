-- AlterTable
ALTER TABLE "post" ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "post_liked" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likerIp" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_liked_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_liked_postId_idx" ON "post_liked"("postId");

-- CreateIndex
CREATE INDEX "post_liked_likerIp_idx" ON "post_liked"("likerIp");

-- CreateIndex
CREATE UNIQUE INDEX "post_liked_postId_likerIp_key" ON "post_liked"("postId", "likerIp");

-- AddForeignKey
ALTER TABLE "post_liked" ADD CONSTRAINT "post_liked_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
