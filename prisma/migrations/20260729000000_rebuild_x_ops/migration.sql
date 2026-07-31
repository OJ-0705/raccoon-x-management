-- ============================================================================
-- 旧スキーマ（脂質制限アカウント運用）を撤去する。
-- 移行前のデータは JSON へ退避済み（2026-07-29 バックアップ）。
-- _prisma_migrations は残す。
-- ============================================================================

DROP TABLE IF EXISTS "PostAnalytics" CASCADE;
DROP TABLE IF EXISTS "PostMetric" CASCADE;
DROP TABLE IF EXISTS "ApiUsage" CASCADE;
DROP TABLE IF EXISTS "ApiCost" CASCADE;
DROP TABLE IF EXISTS "SamplePost" CASCADE;
DROP TABLE IF EXISTS "StyleSample" CASCADE;
DROP TABLE IF EXISTS "Analytics" CASCADE;
DROP TABLE IF EXISTS "AccountMetric" CASCADE;
DROP TABLE IF EXISTS "BuzzPattern" CASCADE;
DROP TABLE IF EXISTS "Competitor" CASCADE;
DROP TABLE IF EXISTS "Keyword" CASCADE;
DROP TABLE IF EXISTS "PostTemplate" CASCADE;
DROP TABLE IF EXISTS "Post" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Settings" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;

DROP TYPE IF EXISTS "Platform" CASCADE;
DROP TYPE IF EXISTS "PostStatus" CASCADE;
DROP TYPE IF EXISTS "ApiOperation" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('X', 'THREADS');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'REVIEWED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApiOperation" AS ENUM ('POST_CREATE', 'POST_CREATE_WITH_LINK', 'POST_READ', 'USER_READ', 'MEDIA_UPLOAD', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "xUsername" TEXT,
    "threadsUsername" TEXT,
    "displayName" TEXT,
    "persona" TEXT,
    "theme" TEXT,
    "targetAudience" TEXT,
    "rules" TEXT,
    "ctaPolicy" TEXT,
    "postTypes" TEXT,
    "charLimitMin" INTEGER NOT NULL DEFAULT 100,
    "charLimitMax" INTEGER NOT NULL DEFAULT 250,
    "postingSlots" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "monthlyBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "postType" TEXT,
    "mediaUrls" TEXT,
    "hashtags" TEXT,
    "postToX" BOOLEAN NOT NULL DEFAULT true,
    "postToThreads" BOOLEAN NOT NULL DEFAULT false,
    "threadParentId" TEXT,
    "threadOrder" INTEGER,
    "dedupeTheme" TEXT,
    "dedupeMessage" TEXT,
    "dedupeEntities" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "xPostId" TEXT,
    "threadsPostId" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DOUBLE PRECISION,
    "qualityNote" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMetric" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetchDate" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCost" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "date" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "operation" "ApiOperation" NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "unitPriceUsd" DOUBLE PRECISION NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "postId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleSample" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuzzPattern" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "sourceUrl" TEXT,
    "sourceText" TEXT NOT NULL,
    "hookType" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "analysis" TEXT,
    "impressions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuzzPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "keyword" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTemplate" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMetric" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "date" TEXT NOT NULL,
    "followers" INTEGER,
    "following" INTEGER,
    "totalPosts" INTEGER,
    "totalImpressions" INTEGER,
    "totalEngagements" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_slug_key" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "Post_accountId_status_idx" ON "Post"("accountId", "status");

-- CreateIndex
CREATE INDEX "Post_accountId_scheduledAt_idx" ON "Post"("accountId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Post_xPostId_idx" ON "Post"("xPostId");

-- CreateIndex
CREATE INDEX "PostMetric_platform_fetchDate_idx" ON "PostMetric"("platform", "fetchDate");

-- CreateIndex
CREATE UNIQUE INDEX "PostMetric_postId_platform_fetchDate_key" ON "PostMetric"("postId", "platform", "fetchDate");

-- CreateIndex
CREATE INDEX "ApiCost_date_platform_idx" ON "ApiCost"("date", "platform");

-- CreateIndex
CREATE INDEX "ApiCost_accountId_date_idx" ON "ApiCost"("accountId", "date");

-- CreateIndex
CREATE INDEX "StyleSample_accountId_idx" ON "StyleSample"("accountId");

-- CreateIndex
CREATE INDEX "BuzzPattern_accountId_idx" ON "BuzzPattern"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_accountId_username_key" ON "Competitor"("accountId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_accountId_keyword_key" ON "Keyword"("accountId", "keyword");

-- CreateIndex
CREATE INDEX "PostTemplate_accountId_idx" ON "PostTemplate"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMetric_accountId_platform_date_key" ON "AccountMetric"("accountId", "platform", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_threadParentId_fkey" FOREIGN KEY ("threadParentId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMetric" ADD CONSTRAINT "PostMetric_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleSample" ADD CONSTRAINT "StyleSample_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuzzPattern" ADD CONSTRAINT "BuzzPattern_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTemplate" ADD CONSTRAINT "PostTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMetric" ADD CONSTRAINT "AccountMetric_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

