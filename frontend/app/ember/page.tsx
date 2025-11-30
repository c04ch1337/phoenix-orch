'use client';

import React from 'react';
import { EmberUnitDashboard } from '../../features/ember-unit/components/EmberUnitDashboard';
import { OperationVisualization } from '../../features/ember-unit/components/OperationVisualization';
import { OpportunityEngine } from '../../features/ember-unit/components/OpportunityEngine';
import { TacticalPlaybook } from '../../features/ember-unit/components/TacticalPlaybook';

export default function EmberPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Header */}
        <div className="col-span-12">
          <h1 className="text-3xl font-bold text-red-600 font-mono tracking-wider">
            PHOENIX ORCH // EMBER UNIT
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            TACTICAL OPERATIONS INTERFACE
          </p>
        </div>

        {/* Main Dashboard */}
        <div className="col-span-8">
          <EmberUnitDashboard />
        </div>

        {/* Operation Visualization */}
        <div className="col-span-4">
          <OperationVisualization />
        </div>

        {/* Opportunity Engine */}
        <div className="col-span-6">
          <OpportunityEngine />
        </div>

        {/* Tactical Playbook */}
        <div className="col-span-6">
          <TacticalPlaybook />
        </div>
      </div>
    </div>
  );
}