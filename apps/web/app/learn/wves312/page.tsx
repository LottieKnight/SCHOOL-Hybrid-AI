import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/server/cookieAuth'
import { findUserById } from '@/lib/server/authDb'
import { ModuleHero } from './components/ModuleHero'
import { ChapterNav } from './components/ChapterNav'
import { StudyContent } from './components/StudyContent'
import { GatePrompt } from './components/GatePrompt'

export const metadata = {
  title: 'WVES312 Business Ethics Dossier | SCHOOL',
  description:
    'A cinematic WVES312 Business Ethics dossier at SCHOOL. Chapters 3, 7, 8, 9, 10, 12, 13 and 18 unfold like an investigation with MCQ practice, flashcards, thinkers, and case studies.',
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

export default async function WVES312Page() {
  const user = await getSession()
  const isAuthenticated = !!user

  return (
    <main className="wves312-page">
      <div className="wves312-shell">
        <ModuleHero isAuthenticated={isAuthenticated} />
        <div className="wves312-layout">
          <ChapterNav />
          <div className="wves312-content">
            <StudyContent isAuthenticated={isAuthenticated} />
            {!isAuthenticated && <GatePrompt />}
          </div>
        </div>
      </div>
    </main>
  )
}
