import { useState, useEffect } from 'react';
import { Loader2, FileText, Flame } from 'lucide-react';
import AgentStatus from './AgentStatus';
import ReportPreview from './ReportPreview';
import VoiceCommander from '../../../src/modules/ecosystem/components/VoiceCommander';
import { socket } from '../../../src/services/socket';

interface Report {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
  preview: string;
}

interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Initialize agent states
    setAgents([
      { id: 'A', name: 'Evidence Parser', status: 'idle', progress: 0, message: '' },
      { id: 'B', name: 'Finding Analyzer', status: 'idle', progress: 0, message: '' },
      { id: 'C', name: 'Template Manager', status: 'idle', progress: 0, message: '' },
      { id: 'D', name: 'Risk Scorer', status: 'idle', progress: 0, message: '' },
      { id: 'E', name: 'Asset Analyzer', status: 'idle', progress: 0, message: '' },
      { id: 'F', name: 'Remediation Planner', status: 'idle', progress: 0, message: '' },
      { id: 'G', name: 'Quality Control', status: 'idle', progress: 0, message: '' },
      { id: 'H', name: 'Exporter', status: 'idle', progress: 0, message: '' },
    ]);

    // Subscribe to agent status updates
    const unsubscribeAgentStatus = socket.onMessage((data) => {
      if (data.type === 'agent_status' && data.agentId && data.status) {
        setAgents(prev => prev.map(agent => 
          agent.id === data.agentId ? { ...agent, ...data.status } : agent
        ));
      }
    });

    // Subscribe to new reports
    const unsubscribeNewReport = socket.onMessage((data) => {
      if (data.type === 'new_report' && data.report) {
        setReports(prev => [...prev, data.report]);
        // Reset generating state when report is received
        setIsGenerating(false);
      }
      
      // Handle report generation completion
      if (data.type === 'report_generation_complete' || data.type === 'report_generation_error') {
        setIsGenerating(false);
      }
    });

    return () => {
      unsubscribeAgentStatus();
      unsubscribeNewReport();
    };
  }, []);

  const handleGenerateReport = async () => {
    if (!socket.isConnected()) {
      console.error('🔥 WebSocket not connected, cannot generate report');
      return;
    }

    setIsGenerating(true);
    try {
      socket.send({ type: 'generate_report' });
      // Note: In real implementation, wait for completion signal from backend
      // For now, reset after a delay as a fallback
      setTimeout(() => {
        setIsGenerating(false);
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error('Failed to generate report:', error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-red-600 font-mono tracking-wider mb-2">
              POST-ENGAGEMENT REPORTS
            </h1>
            <p className="text-sm text-zinc-400 font-mono">
              Phoenix ORCH Report Squad — Automated Intelligence Synthesis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="px-6 py-3 bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-white font-mono text-sm flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>GENERATING...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>GENERATE REPORT</span>
                </>
              )}
            </button>
            <VoiceCommander />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Status Panel */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-red-700/50 rounded-lg p-4 h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-white font-mono">AGENT STATUS</h2>
              </div>
              <div className="space-y-3">
                {agents.map(agent => (
                  <AgentStatus
                    key={agent.id}
                    agent={agent}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Reports Panel */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 border border-red-700/50 rounded-lg p-4 h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-white font-mono">REPORTS</h2>
              </div>
              <div className="space-y-4">
                {reports.length > 0 ? (
                  reports.map(report => (
                    <ReportPreview
                      key={report.id}
                      report={report}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-400 font-mono text-sm mb-2">
                      No reports generated yet.
                    </p>
                    <p className="text-zinc-500 font-mono text-xs">
                      Click "GENERATE REPORT" to create a new report.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
