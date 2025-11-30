import React from 'react';

export default function CipherLoading() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Header Skeleton */}
        <div className="col-span-12">
          <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse"></div>
        </div>

        {/* Main Defense Dashboard Skeleton */}
        <div className="col-span-8">
          <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
            <div className="h-6 w-48 bg-zinc-800 rounded animate-pulse mb-4"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-40 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-40 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Active Defenses Panel Skeleton */}
        <div className="col-span-4">
          <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
            <div className="h-6 w-40 bg-zinc-800 rounded animate-pulse mb-4"></div>
            <div className="space-y-4">
              <div className="h-20 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-20 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-20 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Incident Dashboard Skeleton */}
        <div className="col-span-8">
          <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
            <div className="h-6 w-44 bg-zinc-800 rounded animate-pulse mb-4"></div>
            <div className="space-y-4">
              <div className="h-32 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-24 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Metrics Panel Skeleton */}
        <div className="col-span-4">
          <div className="bg-zinc-900/80 border border-red-700 rounded-lg p-4">
            <div className="h-6 w-36 bg-zinc-800 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              <div className="h-12 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-12 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-12 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-12 bg-zinc-800 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}