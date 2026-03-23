/**
 * GET /api/cron/notion-sync
 *
 * Reads product info and personal notes from Notion pages (read-only).
 * Stores the result in the Settings table for use during post generation.
 *
 * Runs daily at 21:00 UTC via Vercel Cron.
 * IMPORTANT: Never writes to or modifies Notion. Read-only.
 *
 * Required env var: NOTION_API_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const NOTION_API_BASE = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

// Notion page IDs to read from (read-only)
const NOTION_PAGE_IDS = [
  '31f3fd057d038020a7c7e78d9b8ea6bc', // Instagram script management
  '3213fd057d0380c492a9d69108f90c54', // Database
]

interface NotionBlock {
  type: string
  [key: string]: unknown
}

async function fetchNotionBlocks(pageId: string, apiKey: string): Promise<string> {
  const res = await fetch(`${NOTION_API_BASE}/blocks/${pageId}/children?page_size=50`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
    },
  })

  if (!res.ok) {
    console.error(`[notion-sync] Failed to fetch page ${pageId}: ${res.status}`)
    return ''
  }

  const data = await res.json() as { results?: NotionBlock[] }
  if (!data.results) return ''

  const lines: string[] = []
  for (const block of data.results) {
    const text = extractTextFromBlock(block)
    if (text) lines.push(text)
  }
  return lines.join('\n')
}

function extractTextFromBlock(block: NotionBlock): string {
  const richTextTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout']

  for (const type of richTextTypes) {
    if (block.type === type) {
      const blockData = block[type] as { rich_text?: Array<{ plain_text?: string }> }
      if (blockData?.rich_text) {
        return blockData.rich_text.map(t => t.plain_text || '').join('')
      }
    }
  }
  return ''
}

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = (process.env.NOTION_API_KEY || '').trim()
  if (!apiKey) {
    return NextResponse.json({
      skipped: true,
      message: 'NOTION_API_KEY not set — Notion sync skipped',
    })
  }

  try {
    const allText: string[] = []

    for (const pageId of NOTION_PAGE_IDS) {
      const text = await fetchNotionBlocks(pageId, apiKey)
      if (text) allText.push(text)
    }

    const context = allText.join('\n\n---\n\n').slice(0, 3000) // Limit to 3000 chars for prompt usage

    // Store in Settings table (read-only from Notion, writing to our own DB)
    await prisma.settings.upsert({
      where: { key: 'notion_context' },
      create: { key: 'notion_context', value: context },
      update: { value: context },
    })

    console.log(`[notion-sync] Synced ${context.length} chars from ${NOTION_PAGE_IDS.length} Notion pages`)

    return NextResponse.json({
      success: true,
      pages: NOTION_PAGE_IDS.length,
      characters: context.length,
      preview: context.slice(0, 200) + '...',
      time: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[notion-sync] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
