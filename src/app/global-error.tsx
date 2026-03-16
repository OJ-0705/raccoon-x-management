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
      <body className="bg-gray-900 text-white flex items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-4 max-w-2xl w-full">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-red-400">サーバーエラーが発生しました</h2>
          <div className="bg-gray-800 border border-red-800 rounded-xl p-4 text-left">
            <p className="text-red-300 text-sm font-mono break-all">{error.message || error.toString()}</p>
            {error.digest && (
              <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>
            )}
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            再試行
          </button>
        </div>
      </body>
    </html>
  )
}
