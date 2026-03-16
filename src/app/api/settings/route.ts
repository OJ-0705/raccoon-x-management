import { NextRequest, NextResponse } from 'next/server'

// Simple settings stored as env reference (Slack webhook configured via SLACK_WEBHOOK_URL env var)
export async function GET() {
  return NextResponse.json({
    slackWebhookConfigured: !!process.env.SLACK_WEBHOOK_URL,
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
    threadsConfigured: !!(process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID),
    xConfigured: !!(process.env.X_CONSUMER_KEY && process.env.X_ACCESS_TOKEN),
  })
}

// POST allows saving the Slack webhook URL to a runtime variable (session-scoped only)
let runtimeSlackWebhook = ''

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.slackWebhookUrl !== undefined) {
    runtimeSlackWebhook = body.slackWebhookUrl
    // Note: this is runtime-only; for persistence, set SLACK_WEBHOOK_URL env var in Vercel
    return NextResponse.json({ success: true, message: 'Webhook URLを保存しました（このセッション限り）' })
  }
  return NextResponse.json({ error: 'Unknown setting' }, { status: 400 })
}

export { runtimeSlackWebhook }
