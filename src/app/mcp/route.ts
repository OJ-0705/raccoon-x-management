import { xmcpHandler } from '@xmcp/adapter'

/**
 * MCPエンドポイント。Claude Code からはここに繋いで運用する。
 *
 *   claude mcp add --transport http x-ops https://<domain>/mcp \
 *     --header "Authorization: Bearer $MCP_AUTH_TOKEN"
 *
 * MCP_AUTH_TOKEN が未設定のときの挙動は環境で変える。
 *   開発 … 認証なしで通す（ローカルで叩けないと不便なため）
 *   本番 … 503で閉じる。投稿ツールが無防備に公開されるくらいなら落ちていた方がいい。
 */

export const maxDuration = 300

function deny(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json', ...(status === 401 ? { 'www-authenticate': 'Bearer' } : {}) },
  })
}

async function handler(request: Request) {
  const expected = (process.env.MCP_AUTH_TOKEN || '').trim()

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[mcp] MCP_AUTH_TOKEN が未設定のため、エンドポイントを閉じています。')
      return deny(503, 'MCP_AUTH_TOKEN is not configured')
    }
    return xmcpHandler(request)
  }

  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (token !== expected) return deny(401, 'unauthorized')

  return xmcpHandler(request)
}

export { handler as GET, handler as POST, handler as DELETE }
