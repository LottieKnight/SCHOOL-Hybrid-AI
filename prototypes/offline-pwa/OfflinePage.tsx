'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOfflineStatus } from './useOffline';

const cachedPages = [
  { href: '/', label: 'Dashboard', description: 'Your modules, credits, and activity' },
  { href: '/community', label: 'Community', description: 'Module rooms and discussions (cached)' },
  { href: '/past-papers', label: 'Past Papers', description: 'Browse cached past papers' },
  { href: '/assistant', label: 'AI Tutor', description: 'Limited offline mode available' },
  { href: '/daily-quiz', label: 'Daily Quiz', description: 'Cached quizzes available offline' },
  { href: '/planner', label: 'Study Planner', description: 'View your timetable offline' },
  { href: '/features', label: 'Features', description: 'Platform overview' },
];

export default function OfflinePage() {
  const { online, forceSync, syncStatus } = useOfflineStatus();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (online) {
      window.location.href = '/';
    }
  }, [online]);

  const handleRetry = async () => {
    setRetryCount(c => c + 1);
    await forceSync();
    if (navigator.onLine) {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-950 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <svg className="mx-auto h-24 w-24 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">You're Offline</h1>
        <p className="text-gray-400 mb-8">
          No internet connection detected. SCHOOL works offline — your data syncs automatically when you're back online.
        </p>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 mb-8 text-left">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Available Offline
          </h3>
          <ul className="space-y-3">
            {cachedPages.map((page) => (
              <li key={page.href} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Link href={page.href} className="flex-1 text-left group">
                  <p className="text-white font-medium group-hover:text-emerald-400 transition-colors">{page.label}</p>
                  <p className="text-gray-500 text-sm mt-1">{page.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Pending sync</span>
            <span className="text-emerald-400 font-mono">{syncStatus.pending}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-400">Failed</span>
            <span className="text-red-400 font-mono">{syncStatus.failed}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-gray-400">Retry attempt</span>
            <span className="text-yellow-400 font-mono">{retryCount}</span>
          </div>
        </div>

        <button
          onClick={handleRetry}
          disabled={!navigator.onLine}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {navigator.onLine ? 'Sync & Go Online' : 'Waiting for Connection...'}
        </button>

        <p className="mt-6 text-gray-500 text-sm">
          Built for South African connections. Data-light by design.
        </p>
      </div>
    </div>
  );
}