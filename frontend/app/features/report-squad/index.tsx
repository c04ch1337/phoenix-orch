/**
 * Report Squad Feature Module
 * 
 * Note: This module has been moved from the root features directory.
 * Component implementations need to be migrated in a future task.
 */

// Component exports are commented out until implementation migrates
// export { default as ReportsPage } from './components/ReportsPage';
// export { default as AgentStatus } from './components/AgentStatus';
// export { default as ReportPreview } from './components/ReportPreview';

// Types (migrated)
export interface Report {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
  preview: string;
}

export interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

// Socket Events (migrated)
export const REPORT_SQUAD_EVENTS = {
  GENERATE_REPORT: 'generate_report',
  AGENT_STATUS: 'agent_status',
  NEW_REPORT: 'new_report',
} as const;

// Constants (migrated)
export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export const AGENT_IDS = {
  EVIDENCE_PARSER: 'A',
  FINDING_ANALYZER: 'B',
  TEMPLATE_MANAGER: 'C',
  RISK_SCORER: 'D',
  ASSET_ANALYZER: 'E',
  REMEDIATION_PLANNER: 'F',
  QUALITY_CONTROL: 'G',
  EXPORTER: 'H',
} as const;

export const EXPORT_FORMATS = {
  PDF: 'pdf',
  MARKDOWN: 'md',
  HTML: 'html',
  WORD: 'docx',
  JSON: 'json',
} as const;

// Default export with migration status information
const reportSquadModule = {
  status: 'migrated-structure',
  message: 'Report Squad feature directory structure has been migrated, but component implementations need to be added in a future task.',
  originalLocation: 'frontend/features/report-squad',
  targetLocation: 'frontend/app/features/report-squad',
};

export default reportSquadModule;