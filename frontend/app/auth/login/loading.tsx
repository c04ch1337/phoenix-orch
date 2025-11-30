import React from 'react';

export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-8 max-w-md w-full">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse mb-6"></div>
        
        <div className="space-y-6">
          <div>
            <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-2"></div>
            <div className="h-10 w-full bg-zinc-800 rounded animate-pulse"></div>
          </div>
          
          <div className="h-10 w-full bg-zinc-800 rounded animate-pulse"></div>
        </div>
        
        <div className="mt-6 flex justify-center">
          <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}