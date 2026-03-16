'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[root error]', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#111827',
      color: 'white',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '640px', width: '100%' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#F87171', marginBottom: '16px' }}>
          エラーが発生しました
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
    </div>
  )
}
