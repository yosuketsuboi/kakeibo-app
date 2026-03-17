'use client'

import { createContext, useContext } from 'react'
import type { Tables } from '@/lib/types/database'

type HouseholdContextType = {
  household: Tables<'households'> | null
  categories: Tables<'categories'>[]
  paymentMethods: Tables<'payment_methods'>[]
  loading: boolean
  refreshPaymentMethods: () => Promise<void>
}

export const HouseholdContext = createContext<HouseholdContextType>({
  household: null,
  categories: [],
  paymentMethods: [],
  loading: true,
  refreshPaymentMethods: async () => {},
})

export function useHousehold() {
  return useContext(HouseholdContext)
}
