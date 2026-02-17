'use client'

import { createContext, useContext } from 'react'
import type { Tables } from '@/lib/types/database'

type HouseholdContextType = {
  household: Tables<'households'> | null
  categories: Tables<'categories'>[]
  loading: boolean
}

export const HouseholdContext = createContext<HouseholdContextType>({
  household: null,
  categories: [],
  loading: true,
})

export function useHousehold() {
  return useContext(HouseholdContext)
}
