import { Clock } from 'lucide-react';

interface UptimeDisplayProps {
  uptime: string;
}

export default function UptimeDisplay({ uptime }: UptimeDisplayProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4 text-red-600 flex-shrink-0" />
        <span className="text-zinc-400 text-xs font-mono uppercase tracking-wider">UPTIME</span>
      </div>
      <div className="flex items-center">
        <span className="text-red-600 font-bold font-mono text-sm">
          Days since rebirth: <span className="text-red-500">{uptime}</span>
        </span>
      </div>
    </div>
  );
}