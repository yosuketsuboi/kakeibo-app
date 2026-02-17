'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
// DEFAULT_CATEGORIES is now handled by the database function

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    // Sign up
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('登録に失敗しました')
      setLoading(false)
      return
    }

    if (inviteToken) {
      // Accept invitation
      const { data: invitation } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', inviteToken)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (invitation) {
        await supabase.from('household_members').insert({
          household_id: invitation.household_id,
          user_id: authData.user.id,
          role: 'member',
        })

        await supabase
          .from('invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)
      }
    } else {
      // DB関数で世帯・メンバー・カテゴリを一括作成（SECURITY DEFINERでRLSバイパス）
      const { data, error: rpcError } = await supabase.rpc('create_household_for_user', {
        p_household_name: householdName || `${email}の家計簿`,
      })

      if (rpcError) {
        console.error('Household creation error:', rpcError)
        setError('世帯の作成に失敗しました')
        setLoading(false)
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">
          {inviteToken ? '招待を受けて登録' : '新規登録'}
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="6文字以上"
            />
          </div>

          {!inviteToken && (
            <div>
              <label htmlFor="householdName" className="block text-sm font-medium mb-1">
                世帯名（任意）
              </label>
              <input
                id="householdName"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 田中家"
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          アカウントをお持ちの方は{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
