'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@raccoon.com')
  const [password, setPassword] = useState('raccoon2026')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setError('')
        alert('初期データのセットアップが完了しました。ログインしてください。')
      } else {
        setError('セットアップに失敗しました: ' + data.error)
      }
    } catch {
      setError('セットアップに失敗しました')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🍊</div>
          <h1 className="text-2xl font-bold text-white">らくーん</h1>
          <p className="text-gray-400 text-sm mt-1">X自動運用管理システム</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-6">ログイン</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                placeholder="admin@raccoon.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white font-bold rounded-xl transition-colors text-sm"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2 text-center">初回セットアップ</p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 font-medium rounded-xl transition-colors text-sm"
            >
              {seeding ? 'セットアップ中...' : '初期データをセットアップ'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          らくーん🍊 X自動運用管理システム v1.0
        </p>
      </div>
    </div>
  )
}
