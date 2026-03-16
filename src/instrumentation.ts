export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { Pool } = await import('pg')

    const pool = new Pool({
      connectionString: process.env.STORAGE_URL_NON_POOLING || process.env.STORAGE_URL,
    })

    const client = await pool.connect()
    try {
      // テーブルが存在しない場合のみ作成（冪等）
      await client.query(`
        CREATE TABLE IF NOT EXISTS "Post" (
          "id" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "postType" TEXT NOT NULL,
          "formatType" TEXT NOT NULL DEFAULT 'テキスト',
          "status" TEXT NOT NULL DEFAULT '下書き',
          "scheduledAt" TIMESTAMP(3),
          "postedAt" TIMESTAMP(3),
          "xPostId" TEXT,
          "impressions" INTEGER NOT NULL DEFAULT 0,
          "likes" INTEGER NOT NULL DEFAULT 0,
          "retweets" INTEGER NOT NULL DEFAULT 0,
          "replies" INTEGER NOT NULL DEFAULT 0,
          "bookmarks" INTEGER NOT NULL DEFAULT 0,
          "imageUrls" TEXT,
          "hashtags" TEXT,
          "threadPosts" TEXT,
          "parentPostId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "Competitor" (
          "id" TEXT NOT NULL,
          "username" TEXT NOT NULL,
          "displayName" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "Keyword" (
          "id" TEXT NOT NULL,
          "keyword" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "Analytics" (
          "id" TEXT NOT NULL,
          "date" TIMESTAMP(3) NOT NULL,
          "followers" INTEGER,
          "totalImpressions" INTEGER,
          "totalEngagements" INTEGER,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "PostTemplate" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "postType" TEXT NOT NULL,
          "templateContent" TEXT NOT NULL,
          "isDefault" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PostTemplate_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "password" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "User_pkey" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "Session" (
          "id" TEXT NOT NULL,
          "sessionToken" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "expires" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "Competitor_username_key" ON "Competitor"("username");
        CREATE UNIQUE INDEX IF NOT EXISTS "Keyword_keyword_key" ON "Keyword"("keyword");
        CREATE UNIQUE INDEX IF NOT EXISTS "Analytics_date_key" ON "Analytics"("date");
        CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
        CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'Session_userId_fkey'
          ) THEN
            ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
              FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      console.log('[db] Tables ready')
    } catch (error) {
      console.error('[db] Init error:', error)
    } finally {
      client.release()
      await pool.end()
    }
  }
}
