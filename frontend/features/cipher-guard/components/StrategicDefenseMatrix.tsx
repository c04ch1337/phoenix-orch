'use client';

import React, { useState } from 'react';

const killChainPhases = [
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    description: 'Threat intelligence gathering and monitoring',
    icon: '📡',
    detectionMechanisms: ['Network Monitoring', 'Threat Intelligence Feeds', 'Honeypots'],
    preventionControls: ['Network Segmentation', 'Information Disclosure Controls'],
    effectivenessScore: 85
  },
  {
    id: 'weaponization',
    name: 'Weaponization',
    description: 'Malware creation and payload development',
    icon: '⚔️',
    detectionMechanisms: ['File Analysis', 'Behavioral Analysis', 'Sandboxing'],
    preventionControls: ['Application Whitelisting', 'Code Signing'],
    effectivenessScore: 78
  },
  {
    id: 'delivery',
    name: 'Delivery',
    description: 'Attack vector deployment',
    icon: '📦',
    detectionMechanisms: ['Email Filtering', 'Web Filtering', 'Network Traffic Analysis'],
    preventionControls: ['Spam Filters', 'Web Application Firewalls'],
    effectivenessScore: 92
  },
  {
    id: 'exploitation',
    name: 'Exploitation',
    description: 'Vulnerability exploitation',
    icon: '💥',
    detectionMechanisms: ['IDS/IPS', 'Vulnerability Scanning', 'Runtime Protection'],
    preventionControls: ['Patch Management', 'System Hardening'],
    effectivenessScore: 88
  },
  {
    id: 'installation',
    name: 'Installation',
    description: 'Malware installation and persistence',
    icon: '🔧',
    detectionMechanisms: ['File Integrity Monitoring', 'Registry Monitoring', 'Process Monitoring'],
    preventionControls: ['Endpoint Protection', 'Application Control'],
    effectivenessScore: 82
  },
  {
    id: 'command_control',
    name: 'Command & Control',
    description: 'Remote control establishment',
    icon: '🕹️',
    detectionMechanisms: ['DNS Monitoring', 'Network Traffic Analysis', 'Behavioral Analytics'],
    preventionControls: ['Network Segmentation', 'Proxy Filtering'],
    effectivenessScore: 79
  },
  {
    id: 'actions_objectives',
    name: 'Actions on Objectives',
    description: 'Goal achievement and data exfiltration',
    icon: '🎯',
    detectionMechanisms: ['DLP Systems', 'Data Access Monitoring', 'User Behavior Analytics'],
    preventionControls: ['Access Controls', 'Encryption', 'Data Classification'],
    effectivenessScore: 91
  }
];

const controlTypes = [
  {
    type: 'preventive',
    name: 'Preventive Controls',
    description: 'Controls that prevent security incidents',
    implementationStatus: 'optimized',
    effectivenessRating: 95
  },
  {
    type: 'detective',
    name: 'Detective Controls',
    description: 'Controls that detect security incidents',
    implementationStatus: 'implemented',
    effectivenessRating: 88
  },
  {
    type: 'corrective',
    name: 'Corrective Controls',
    description: 'Controls that correct security incidents',
    implementationStatus: 'implemented',
    effectivenessRating: 85
  },
  {
    type: 'compensating',
    name: 'Compensating Controls',
    description: 'Alternative controls when primary controls fail',
    implementationStatus: 'planned',
    effectivenessRating: 70
  }
];

export default function StrategicDefenseMatrix() {
  const [selectedPhase, setSelectedPhase] = useState(killChainPhases[0]);

  const getEffectivenessColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimized': return 'text-green-400';
      case 'implemented': return 'text-blue-400';
      case 'planned': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="strategic-defense-matrix bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Strategic Defense Matrix</h2>
      
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kill Chain Phases */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">Kill Chain Phases Defense</h3>
          
          <div className="space-y-3">
            {killChainPhases.map((phase) => (
              <div
                key={phase.id}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  selectedPhase.id === phase.id
                    ? 'bg-blue-600 border-l-4 border-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setSelectedPhase(phase)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{phase.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{phase.name}</div>
                    <div className="text-sm text-gray-300">{phase.description}</div>
                  </div>
                  <div className={`text-lg font-bold ${getEffectivenessColor(phase.effectivenessScore)}`}>
                    {phase.effectivenessScore}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Phase Details */}
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">
            {selectedPhase.icon} {selectedPhase.name} Details
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-white mb-2">Detection Mechanisms</h4>
              <div className="space-y-1">
                {selectedPhase.detectionMechanisms.map((mechanism, index) => (
                  <div key={index} className="text-sm text-gray-300 bg-gray-600 px-2 py-1 rounded">
                    {mechanism}
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-white mb-2">Prevention Controls</h4>
              <div className="space-y-1">
                {selectedPhase.preventionControls.map((control, index) => (
                  <div key={index} className="text-sm text-gray-300 bg-gray-600 px-2 py-1 rounded">
                    {control}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Effectiveness:</span>
                <span className={`font-bold ${getEffectivenessColor(selectedPhase.effectivenessScore)}`}>
                  {selectedPhase.effectivenessScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Types */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">Control Types Framework</h3>
        
        <div className="grid md:grid-cols-4 gap-4">
          {controlTypes.map((control) => (
            <div key={control.type} className="bg-gray-700 rounded-lg p-4">
              <div className="font-medium text-white mb-2">{control.name}</div>
              <div className="text-sm text-gray-300 mb-3">{control.description}</div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Status:</span>
                <span className={getStatusColor(control.implementationStatus)}>
                  {control.implementationStatus}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-400">Effectiveness:</span>
                <span className={getEffectivenessColor(control.effectivenessRating)}>
                  {control.effectivenessRating}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}