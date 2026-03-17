'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HouseholdContext } from '@/lib/hooks/useHousehold'
import type { Tables } from '@/lib/types/database'

export default function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<Tables<'households'> | null>(null)
  const [categories, setCategories] = useState<Tables<'categories'>[]>([])
  const [paymentMethods, setPaymentMethods] = useState<Tables<'payment_methods'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Get first household the user belongs to
      const { data: members } = await supabase
        .from('household_members')
        .select('household_id, households(*)')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (members?.households) {
        const h = members.households as unknown as Tables<'households'>
        setHousehold(h)

        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .eq('household_id', h.id)
          .order('sort_order')

        setCategories(cats || [])

        const { data: methods } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('household_id', h.id)
          .order('sort_order')

        setPaymentMethods(methods || [])
      }
      setLoading(false)
    }

    load()
  }, [])

  async function refreshPaymentMethods() {
    if (!household) return
    const supabase = createClient()
    const { data: methods } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('household_id', household.id)
      .order('sort_order')
    setPaymentMethods(methods || [])
  }

  return (
    <HouseholdContext.Provider value={{ household, categories, paymentMethods, loading, refreshPaymentMethods }}>
      {children}
    </HouseholdContext.Provider>
  )
}
