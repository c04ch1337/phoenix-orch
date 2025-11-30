'use client';

import React from 'react';
import SkillManifesto from './SkillManifesto';
import StrategicDefenseMatrix from './StrategicDefenseMatrix';
import VulnerabilityDefenseMap from './VulnerabilityDefenseMap';
import ActiveDefensesPanel from './ActiveDefensesPanel';
import IncidentDashboard from './IncidentDashboard';
import EvidenceGallery from './EvidenceGallery';
import ReportingConsole from './ReportingConsole';

export default function CipherGuardPage() {
  return (
    <div className="grid grid-cols-4 gap-4 p-4 bg-neutral-900 min-h-screen">
      {/* Skill Manifesto Section */}
      <div className="col-span-2">
        <SkillManifesto />
      </div>
      
      {/* Strategic Defense Matrix */}
      <div className="col-span-2">
        <StrategicDefenseMatrix />
      </div>
      
      {/* Vulnerability Defense Map */}
      <div className="col-span-3">
        <VulnerabilityDefenseMap />
      </div>
      
      {/* Active Defenses Panel */}
      <div className="col-span-1">
        <ActiveDefensesPanel />
      </div>
      
      {/* Incident Dashboard */}
      <div className="col-span-2">
        <IncidentDashboard />
      </div>
      
      {/* Evidence Gallery */}
      <div className="col-span-1">
        <EvidenceGallery />
      </div>
      
      {/* Reporting Console */}
      <div className="col-span-1">
        <ReportingConsole />
      </div>
    </div>
  );
}