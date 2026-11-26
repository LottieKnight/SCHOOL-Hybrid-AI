'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, onOnline, onOffline, isOnline } from './offline-db';

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [online, setOnline] = useState(() => isOnline());
  const [swRegistered, setSwRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const unsubscribeOnline = onOnline(() => setOnline(true));
    const unsubscribeOffline = onOffline(() => setOnline(false));

    registerServiceWorker().then((registration) => {
      if (registration) {
        setSwRegistered(true);
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      }
    });

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
    };
  }, []);

  const applyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  };

  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {updateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-gray-900 border border-emerald-500 rounded-xl p-4 shadow-xl max-w-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-white font-medium">App Update Available</p>
                <p className="text-gray-400 text-sm mt-1">A new version of SCHOOL is ready. Refresh to get the latest features.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyUpdate}
                  className="bg-emerald-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setUpdateAvailable(false)}
                  className="bg-gray-700 text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!online && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-up">
          <div className="bg-amber-900/90 border border-amber-500 rounded-xl p-4 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-white font-medium">You're Offline</p>
                <p className="text-amber-200 text-sm">Changes will sync when you're back online.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </>
  );
}