'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ja">
      <body style={{
        backgroundColor: '#111827',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        padding: '24px',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '640px', width: '100%' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#F87171', marginBottom: '16px' }}>
            サーバーエラーが発生しました
          </h2>
          <div style={{
            backgroundColor: '#1F2937',
            border: '1px solid #991B1B',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '16px',
          }}>
            <p style={{ color: '#FCA5A5', fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {error.message || error.toString()}
            </p>
            {error.digest && (
              <p style={{ color: '#6B7280', fontSize: '12px', marginTop: '8px' }}>
                Digest: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#F97316',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            再試行
          </button>
        </div>
      </body>
    </html>
  )
}
