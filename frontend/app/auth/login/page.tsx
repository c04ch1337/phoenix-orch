'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const password = formData.get('password') as string;

    try {
      // In a real app, this would be an API call to validate credentials
      if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
        // Set authentication cookie
        document.cookie = 'phoenix_auth_token=authenticated; path=/';
        
        // Redirect to the originally requested page or default to home
        const from = searchParams.get('from') || '/';
        router.push(from);
      } else {
        setError('Invalid authentication code');
      }
    } catch (err) {
      setError('Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-500 mb-6">PHOENIX ORCH // AUTHENTICATION</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-2">
              Authentication Code
            </label>
            <input
              type="password"
              name="password"
              id="password"
              required
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded focus:outline-none focus:border-red-500 text-white"
              placeholder="Enter authentication code"
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          <button
            type="submit"
            className="w-full px-4 py-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors"
          >
            Authenticate
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <div className="text-xs text-zinc-600">
            PHOENIX SECURITY PROTOCOL ACTIVE
          </div>
        </div>
      </div>
    </div>
  );
}