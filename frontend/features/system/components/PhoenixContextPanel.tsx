import React from 'react';

interface PhoenixContextPanelProps {
  conscience_level: number;
  active_mission: string | null;
  ember_targets: number;
  cipher_anomalies: number;
  memory_age: number;
}

export const PhoenixContextPanel: React.FC<PhoenixContextPanelProps> = ({
  conscience_level,
  active_mission,
  ember_targets,
  cipher_anomalies,
  memory_age,
}) => {
  return (
    <div className="phoenix-context-panel">
      <h2>PHOENIX CONTEXT</h2>
      
      <div className="context-metric">
        <label>Conscience:</label>
        <div className="flame-meter">
          <div 
            className="flame-level" 
            style={{width: `${conscience_level}%`}}
          />
          <span>{conscience_level}%</span>
        </div>
      </div>

      <div className="context-metric">
        <label>Active Mission:</label>
        <span>{active_mission || "None"}</span>
      </div>

      <div className="context-metric">
        <label>Ember watching:</label>
        <span>{ember_targets} targets</span>
      </div>

      <div className="context-metric">
        <label>Cipher watching:</label>
        <span>{cipher_anomalies} anomalies</span>
      </div>

      <div className="context-metric">
        <label>Memory age:</label>
        <span>{memory_age} days since rebirth</span>
      </div>
    </div>
  );
};