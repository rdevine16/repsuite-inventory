import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Nav from '@/components/nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <Nav userEmail={user.email ?? ''} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </>
  )
}
