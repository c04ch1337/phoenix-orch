export { default as MemoryTimeline } from './components/MemoryTimeline';

export interface LogEntry {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  type: 'operation' | 'sentinel' | 'poetry' | 'network';
}

export interface CommunicationLogs {
  entries: LogEntry[];
  totalCount: number;
}