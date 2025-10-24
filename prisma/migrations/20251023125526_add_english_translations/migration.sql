-- AlterTable
ALTER TABLE "post" ADD COLUMN     "content_en" TEXT,
ADD COLUMN     "excerpt_en" TEXT,
ADD COLUMN     "slug_en" TEXT,
ADD COLUMN     "title_en" TEXT;

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "description_en" TEXT,
ADD COLUMN     "name_en" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "post_slug_en_key" ON "post"("slug_en");

-- CreateIndex
CREATE INDEX "post_slug_en_idx" ON "post"("slug_en");
