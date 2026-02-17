import BottomNav from '@/components/BottomNav'
import HouseholdProvider from '@/components/providers/HouseholdProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <div className="min-h-screen pb-20">
        {children}
      </div>
      <BottomNav />
    </HouseholdProvider>
  )
}
