import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/server/cookieAuth'
import { findUserById } from '@/lib/server/authDb'
import { ModuleHero } from './components/ModuleHero'
import { ChapterNav } from './components/ChapterNav'
import { StudyContent } from './components/StudyContent'

export const metadata = {
  title: 'EKRP211 Introduction to Risk Management | SCHOOL',
  description:
    'A premium EKRP 211 Risk Management study surface at SCHOOL. Ten chapters covering risk foundations, ISO 31000, COSO ERM, King IV, credit, liquidity, market, and operational risk — with MCQ practice, case studies (Steinhoff, GM, Satyam), and model answers.',
}

async function getSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('saedu_session')?.value
    if (!token) return null
    const payload = await verifyToken(token)
    if (!payload?.sub) return null
    const user = await findUserById(payload.sub)
    return user ?? null
  } catch {
    return null
  }
}

export default async function EKRP211Page() {
  const user = await getSession()
  const isAuthenticated = !!user

  return (
    <main className="ekrp211-page">
      <div className="ekrp211-shell">
        <ModuleHero isAuthenticated={isAuthenticated} />
        <div className="ekrp211-layout">
          <ChapterNav />
          <div className="ekrp211-content">
            <StudyContent isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </div>
    </main>
  )
}
