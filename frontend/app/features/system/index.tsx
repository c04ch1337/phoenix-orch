import React from 'react';

// CoreTemp Component
export const CoreTemp: React.FC<{ temp: number }> = ({ temp }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400 text-xs">CORE TEMP</span>
      <span className={`text-xs ${temp > 60 ? 'text-red-500' : 'text-green-500'}`}>
        {temp.toFixed(1)}°C
      </span>
    </div>
  );
};

// StorageEnc Component
export const StorageEnc: React.FC<{ storage: number }> = ({ storage }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400 text-xs">STORAGE ENC</span>
      <span className={`text-xs ${storage > 8 ? 'text-orange-500' : 'text-blue-500'}`}>
        {storage.toFixed(1)} PB
      </span>
    </div>
  );
};

// UptimeDisplay Component
export const UptimeDisplay: React.FC<{ uptime: string }> = ({ uptime }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-400 text-xs">UPTIME</span>
      <span className="text-green-500 text-xs">{uptime}</span>
    </div>
  );
};

// ResourceVector Component
interface SystemTelemetry {
  cpu: number;
  gpu: number;
  memory: number;
  network: number;
  thermal: number;
}

export const ResourceVector: React.FC<{ telemetry: SystemTelemetry }> = ({ telemetry }) => {
  return (
    <div className="space-y-1">
      <h3 className="text-xs text-zinc-400 mb-2">RESOURCE VECTOR</h3>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs">CPU</span>
          <div className="w-32 bg-zinc-800 h-1 rounded overflow-hidden">
            <div 
              className="bg-blue-500 h-1" 
              style={{ width: `${telemetry.cpu}%` }}
            ></div>
          </div>
          <span className="text-zinc-400 text-xs ml-2">{telemetry.cpu}%</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs">GPU</span>
          <div className="w-32 bg-zinc-800 h-1 rounded overflow-hidden">
            <div 
              className="bg-purple-500 h-1" 
              style={{ width: `${telemetry.gpu}%` }}
            ></div>
          </div>
          <span className="text-zinc-400 text-xs ml-2">{telemetry.gpu}%</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs">MEM</span>
          <div className="w-32 bg-zinc-800 h-1 rounded overflow-hidden">
            <div 
              className="bg-green-500 h-1" 
              style={{ width: `${telemetry.memory}%` }}
            ></div>
          </div>
          <span className="text-zinc-400 text-xs ml-2">{telemetry.memory}%</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs">NET</span>
          <div className="w-32 bg-zinc-800 h-1 rounded overflow-hidden">
            <div 
              className="bg-cyan-500 h-1" 
              style={{ width: `${telemetry.network}%` }}
            ></div>
          </div>
          <span className="text-zinc-400 text-xs ml-2">{telemetry.network}%</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 text-xs">THERMAL</span>
          <div className="w-32 bg-zinc-800 h-1 rounded overflow-hidden">
            <div 
              className={`h-1 ${
                telemetry.thermal > 80 
                  ? 'bg-red-500' 
                  : telemetry.thermal > 60 
                  ? 'bg-orange-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${telemetry.thermal}%` }}
            ></div>
          </div>
          <span className="text-zinc-400 text-xs ml-2">{telemetry.thermal}%</span>
        </div>
      </div>
    </div>
  );
};

export default {
  CoreTemp,
  StorageEnc,
  UptimeDisplay,
  ResourceVector
};