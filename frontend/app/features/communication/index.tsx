import MemoryTimelineComponent from './components/MemoryTimeline';

// Export MemoryTimeline component
export const MemoryTimeline = MemoryTimelineComponent;

// Define types for communication logs
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

// Default export
export default MemoryTimelineComponent;