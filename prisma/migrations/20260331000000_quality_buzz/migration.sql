-- AlterTable: add quality gate columns and isFavorite to Post
ALTER TABLE "Post" ADD COLUMN "qualityScore" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "qualityDetail" TEXT;
ALTER TABLE "Post" ADD COLUMN "qualityFeedback" TEXT;
ALTER TABLE "Post" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- Add missing columns from previous migrations that may be missing
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'x';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadsPostId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadsImp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadsLikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadsReplies" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "threadsReposts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "abGroupId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "abVariant" TEXT;

-- CreateTable: BuzzPattern
CREATE TABLE "BuzzPattern" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceText" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "hookType" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuzzPattern_pkey" PRIMARY KEY ("id")
);
