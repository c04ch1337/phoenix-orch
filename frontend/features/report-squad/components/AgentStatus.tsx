
interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
}

interface AgentStatusProps {
  agent: AgentState;
}

export default function AgentStatus({ agent }: AgentStatusProps) {
  const getStatusColors = (status: string) => {
    switch (status) {
      case 'processing':
        return {
          indicator: 'bg-orange-500',
          border: 'border-orange-700/50',
          text: 'text-orange-400',
          progress: 'bg-orange-600'
        };
      case 'completed':
        return {
          indicator: 'bg-green-500',
          border: 'border-green-700/50',
          text: 'text-green-400',
          progress: 'bg-green-600'
        };
      case 'error':
        return {
          indicator: 'bg-red-500',
          border: 'border-red-700/50',
          text: 'text-red-400',
          progress: 'bg-red-600'
        };
      default:
        return {
          indicator: 'bg-zinc-500',
          border: 'border-zinc-700/50',
          text: 'text-zinc-400',
          progress: 'bg-zinc-600'
        };
    }
  };

  const colors = getStatusColors(agent.status);

  return (
    <div className={`p-4 border rounded ${colors.border} bg-zinc-900/50 transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className={`w-3 h-3 rounded-full ${colors.indicator} transition-colors duration-300 flex-shrink-0`} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-white font-mono truncate">
              {agent.name}
            </h3>
            <span className={`text-xs font-mono uppercase ${colors.text} ml-2 flex-shrink-0`}>
              {agent.status}
            </span>
          </div>
          
          {/* Processing State */}
          {agent.status === 'processing' && (
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.progress} transition-all duration-500 ease-out`}
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                {agent.message || `Processing... ${agent.progress}%`}
              </p>
            </div>
          )}

          {/* Error State */}
          {agent.status === 'error' && (
            <p className="text-xs text-red-400 font-mono">
              {agent.message || 'An error occurred'}
            </p>
          )}

          {/* Completed State */}
          {agent.status === 'completed' && (
            <p className="text-xs text-green-400 font-mono">
              {agent.message || 'Task completed successfully'}
            </p>
          )}

          {/* Idle State */}
          {agent.status === 'idle' && agent.message && (
            <p className="text-xs text-zinc-400 font-mono">
              {agent.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
