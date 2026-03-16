'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4 p-6">
      <div className="text-red-400 text-2xl">⚠️ エラーが発生しました</div>
      <div className="bg-gray-900 border border-red-800 rounded-xl p-4 max-w-2xl w-full">
        <p className="text-red-300 text-sm font-mono break-all">{error.message}</p>
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
  )
}
