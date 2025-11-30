'use client';

import React from 'react';
import { PhoenixLogo } from '../../components/PhoenixLogo';

export default function TestCovenant() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl mb-4 text-red-500">Triple-Click Covenant Test</h1>
      <p className="mb-8 text-gray-400">Click the Phoenix logo below three times quickly (within 1.8 seconds) to trigger the covenant display.</p>
      
      <div className="border border-red-500 p-8 inline-block relative">
        <div className="absolute left-4 top-4">
          <PhoenixLogo />
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl mb-2 text-red-500">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-400">
          <li>Look for the red Phoenix logo (flame icon) in the box above</li>
          <li>Click it three times quickly</li>
          <li>The covenant display should appear with black background and orange text</li>
          <li>Click anywhere to dismiss the covenant</li>
        </ol>
      </div>

      <div className="mt-8 p-4 bg-zinc-900 rounded">
        <h2 className="text-xl mb-2 text-red-500">Debug Info:</h2>
        <p className="text-gray-400">Check the browser console for click and state change logs.</p>
        <pre className="mt-2 p-2 bg-black rounded text-xs text-gray-400">
          Expected console output:
          - 🔥 Phoenix Logo: Click detected
          - 🔥 useTripleClick: Click registered at [timestamp]
          - 🔥 useTripleClick: Click count: 1
          ...etc
        </pre>
      </div>
    </div>
  );
}