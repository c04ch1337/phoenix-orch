import React from 'react';
import Link from 'next/link';

interface RouteErrorProps {
  title?: string;
  message?: string;
  returnPath?: string;
  returnText?: string;
}

export default function RouteError({
  title = "System Error Detected",
  message = "An unexpected error has occurred in the system.",
  returnPath = "/",
  returnText = "Return to Core"
}: RouteErrorProps) {
  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-8 max-w-lg w-full text-center">
        <div className="text-red-500 text-6xl mb-6">!</div>
        <h1 className="text-2xl font-bold text-red-500 mb-4">{title}</h1>
        <p className="text-zinc-400 mb-8">{message}</p>
        <div className="space-y-4">
          <Link 
            href={returnPath}
            className="inline-block px-6 py-2 bg-red-700/20 border border-red-700/50 rounded text-red-400 hover:bg-red-700/30 transition-colors"
          >
            {returnText}
          </Link>
          <div className="text-xs text-zinc-600">
            Error Code: PHOENIX-{Math.floor(Math.random() * 9000 + 1000)}
          </div>
        </div>
      </div>
    </div>
  );
}