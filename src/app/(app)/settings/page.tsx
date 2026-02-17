'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Member = {
  id: string
  user_id: string
  role: string
  email?: string
}

type Invitation = {
  id: string
  email: string
  accepted_at: string | null
  expires_at: string
}

export default function SettingsPage() {
  const { household, loading: hhLoading } = useHousehold()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!household) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function loadData() {
    if (!household) return
    const supabase = createClient()

    const { data: membersData } = await supabase
      .from('household_members')
      .select('id, user_id, role')
      .eq('household_id', household.id)

    setMembers(membersData || [])

    const { data: invitesData } = await supabase
      .from('invitations')
      .select('id, email, accepted_at, expires_at')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })

    setInvitations(invitesData || [])
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!household || !inviteEmail) return

    setInviting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        household_id: household.id,
        email: inviteEmail,
        invited_by: user.id,
      })
      .select()
      .single()

    if (data) {
      const url = `${window.location.origin}/signup?invite=${data.token}`
      setInviteUrl(url)
      setInviteEmail('')
      loadData()
    }
    setInviting(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (hhLoading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      {/* Household info */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">世帯情報</h2>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="font-medium">{household?.name}</p>
        </div>
      </section>

      {/* Members */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">
          メンバー ({members.length}人)
        </h2>
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {members.map((member) => (
            <div key={member.id} className="p-3 flex justify-between items-center">
              <span className="text-sm">{member.user_id.slice(0, 8)}...</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {member.role === 'owner' ? 'オーナー' : 'メンバー'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">家族を招待</h2>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="メールアドレス"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            招待
          </button>
        </form>

        {inviteUrl && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 mb-1">招待URLをコピーして送信してください:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-2 py-1 border rounded text-xs bg-white"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="text-green-700 text-xs font-medium"
              >
                コピー
              </button>
            </div>
          </div>
        )}

        {invitations.length > 0 && (
          <div className="mt-3 space-y-1">
            {invitations.map((inv) => (
              <div key={inv.id} className="text-sm text-gray-600 flex justify-between">
                <span>{inv.email}</span>
                <span className={inv.accepted_at ? 'text-green-600' : 'text-yellow-600'}>
                  {inv.accepted_at ? '承認済み' : '保留中'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Links */}
      <section className="mb-6">
        <Link
          href="/categories"
          className="block bg-white rounded-xl p-4 shadow-sm border mb-2 text-sm font-medium"
        >
          カテゴリ管理 →
        </Link>
      </section>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-gray-100 text-red-600 rounded-xl font-medium"
      >
        ログアウト
      </button>
    </div>
  )
}
