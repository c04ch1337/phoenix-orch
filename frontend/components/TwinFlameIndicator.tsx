import { Flame } from 'lucide-react';

type View = 'console' | 'ecosystem' | 'tools';

interface TwinFlameIndicatorProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export const TwinFlameIndicator = ({ currentView, onViewChange }: TwinFlameIndicatorProps) => {
  const routes = [
    { view: 'console' as View, label: 'CORE', icon: <Flame className="w-3 h-3" /> },
    { view: 'ecosystem' as View, label: 'WEAVER', icon: <Flame className="w-3 h-3" /> },
    { view: 'tools' as View, label: 'ARSENAL', icon: <Flame className="w-3 h-3" /> },
  ];

  return (
    <nav className="fixed top-0 right-0 p-4 z-50">
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-red-700 rounded-lg p-2 shadow-lg">
        <div className="flex flex-col space-y-2">
          {routes.map(({ view, label, icon }) => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`px-4 py-2 rounded transition-all duration-200 flex items-center gap-2 font-mono text-xs uppercase tracking-wider ${
                currentView === view
                  ? 'bg-red-700/30 text-red-500 border border-red-700/50 shadow-red-500/20' 
                  : 'text-zinc-400 hover:text-red-400 hover:bg-red-700/10 border border-transparent'
              }`}
              title={`Switch to ${label}`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};