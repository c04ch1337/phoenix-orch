'use client';

import React from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Error Loading Forge</h2>
        <p className="text-gray-300 mb-4">
          {error.message || 'An unexpected error occurred while loading the Forge page.'}
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded transition"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}