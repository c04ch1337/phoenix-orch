'use client';

import React from 'react';
import { DefenseDashboard } from '../../features/cipher-guard/components/DefenseDashboard';
import { IncidentDashboard } from '../../features/cipher-guard/components/IncidentDashboard';
import { ActiveDefensesPanel } from '../../features/cipher-guard/components/ActiveDefensesPanel';
import { MetricsPanel } from '../../features/cipher-guard/components/MetricsPanel';

export default function CipherPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Header */}
        <div className="col-span-12">
          <h1 className="text-3xl font-bold text-red-600 font-mono tracking-wider">
            PHOENIX ORCH // CIPHER GUARD
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            DEFENSE MATRIX CONTROL CENTER
          </p>
        </div>

        {/* Main Defense Dashboard */}
        <div className="col-span-8">
          <DefenseDashboard />
        </div>

        {/* Active Defenses Panel */}
        <div className="col-span-4">
          <ActiveDefensesPanel />
        </div>

        {/* Incident Dashboard */}
        <div className="col-span-8">
          <IncidentDashboard />
        </div>

        {/* Metrics Panel */}
        <div className="col-span-4">
          <MetricsPanel />
        </div>
      </div>
    </div>
  );
}