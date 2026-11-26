"use client";

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

/**
 * Simple auth hook that fetches the mock Okta login URL from the
 * `/api/auth/login` endpoint and stores a dummy user object.
 * In a real implementation this would handle the OAuth redirect flow.
 */
export function useAuth() {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchAuth() {
      const res = await fetch('/api/auth/login');
      const data = await res.json();
      setAuthUrl(data.authUrl);
    }
    fetchAuth();
  }, []);

  const login = () => {
    if (authUrl) {
      // In a real app you would redirect the user to the Okta URL.
      // Here we just simulate a successful login.
      setUser({ name: 'Demo User' });
      router.refresh();
    }
  };

  const logout = () => {
    setUser(null);
    router.refresh();
  };

  return { user, login, logout, authUrl };
}
