/**
 * Phoenix Marie Memory Architecture - Retention Monitoring
 * 
 * Visual monitoring component for retention health and status
 * Integrates with mode visual indicators to show retention state
 */

import React, { useState, useEffect } from 'react';
import { retentionManager } from './manager';
import { retentionScheduler } from './scheduler';
import { 
  RetentionHealth,
  KB_RETENTION_POLICIES,
  StorageTier,
  RetentionDuration
} from './policies';

interface RetentionMonitorProps {
  kbName?: string;
  compact?: boolean;
  showSchedule?: boolean;
}

interface RetentionStatus {
  health: RetentionHealth[];
  nextScheduledRuns: Record<string, Date>;
  activeRetentions: string[];
}

/**
 * Get retention duration display string
 */
function getRetentionDisplay(days: number): string {
  if (days === RetentionDuration.ETERNAL) return 'Eternal';
  if (days >= 365) return `${Math.floor(days / 365)} years`;
  return `${days} days`;
}

/**
 * Get health score color
 */
function getHealthColor(score: number): string {
  if (score >= 90) return '#10b981'; // green
  if (score >= 70) return '#f59e0b'; // amber
  if (score >= 50) return '#ef4444'; // red
  return '#991b1b'; // dark red
}

/**
 * Get tier color
 */
function getTierColor(tier: StorageTier): string {
  switch (tier) {
    case StorageTier.HOT:
      return '#ef4444'; // red
    case StorageTier.WARM:
      return '#f59e0b'; // amber
    case StorageTier.COLD:
      return '#3b82f6'; // blue
    case StorageTier.ETERNAL:
      return '#8b5cf6'; // purple
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Retention Monitor Component
 */
export const RetentionMonitor: React.FC<RetentionMonitorProps> = ({
  kbName,
  compact = false,
  showSchedule = true
}) => {
  const [status, setStatus] = useState<RetentionStatus>({
    health: [],
    nextScheduledRuns: {},
    activeRetentions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRetentionStatus();
    const interval = setInterval(loadRetentionStatus, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [kbName]);

  const loadRetentionStatus = async () => {
    try {
      const health = await retentionManager.getRetentionHealth();
      const tasks = retentionScheduler.getScheduledTasks();
      
      const nextRuns: Record<string, Date> = {};
      tasks.forEach(task => {
        if (task.kbName) {
          nextRuns[task.kbName] = task.nextRun;
        }
      });

      setStatus({
        health: kbName ? health.filter(h => h.kbName.toLowerCase().includes(kbName)) : health,
        nextScheduledRuns: nextRuns,
        activeRetentions: [] // Would be populated from active retention operations
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load retention status:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="retention-monitor loading">Loading retention status...</div>;
  }

  if (compact) {
    return <CompactRetentionView status={status} />;
  }

  return (
    <div className="retention-monitor">
      <h3>Memory Retention Status</h3>
      
      {status.health.map(kbHealth => (
        <div key={kbHealth.kbName} className="kb-retention-card">
          <div className="kb-header">
            <h4>{kbHealth.kbName}</h4>
            <div 
              className="health-score"
              style={{ color: getHealthColor(kbHealth.healthScore) }}
            >
              Health: {kbHealth.healthScore}/100
            </div>
          </div>

          <div className="retention-stats">
            <div className="stat-group">
              <span className="stat-label">Total Records:</span>
              <span className="stat-value">{kbHealth.totalRecords.toLocaleString()}</span>
            </div>

            <div className="tier-distribution">
              <div className="tier-bar">
                {kbHealth.hotTierRecords > 0 && (
                  <div 
                    className="tier-segment"
                    style={{
                      width: `${(kbHealth.hotTierRecords / kbHealth.totalRecords) * 100}%`,
                      backgroundColor: getTierColor(StorageTier.HOT)
                    }}
                    title={`Hot: ${kbHealth.hotTierRecords.toLocaleString()}`}
                  />
                )}
                {kbHealth.warmTierRecords > 0 && (
                  <div 
                    className="tier-segment"
                    style={{
                      width: `${(kbHealth.warmTierRecords / kbHealth.totalRecords) * 100}%`,
                      backgroundColor: getTierColor(StorageTier.WARM)
                    }}
                    title={`Warm: ${kbHealth.warmTierRecords.toLocaleString()}`}
                  />
                )}
                {kbHealth.coldTierRecords > 0 && (
                  <div 
                    className="tier-segment"
                    style={{
                      width: `${(kbHealth.coldTierRecords / kbHealth.totalRecords) * 100}%`,
                      backgroundColor: getTierColor(StorageTier.COLD)
                    }}
                    title={`Cold: ${kbHealth.coldTierRecords.toLocaleString()}`}
                  />
                )}
                {kbHealth.eternalRecords > 0 && (
                  <div 
                    className="tier-segment"
                    style={{
                      width: `${(kbHealth.eternalRecords / kbHealth.totalRecords) * 100}%`,
                      backgroundColor: getTierColor(StorageTier.ETERNAL)
                    }}
                    title={`Eternal: ${kbHealth.eternalRecords.toLocaleString()}`}
                  />
                )}
              </div>
            </div>

            {showSchedule && (
              <div className="schedule-info">
                <div className="schedule-item">
                  <span className="schedule-label">Last Run:</span>
                  <span className="schedule-value">
                    {kbHealth.lastRetentionRun.toLocaleString()}
                  </span>
                </div>
                <div className="schedule-item">
                  <span className="schedule-label">Next Run:</span>
                  <span className="schedule-value">
                    {kbHealth.nextScheduledRun.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {kbHealth.pendingActions > 0 && (
              <div className="pending-alert">
                ⚠️ {kbHealth.pendingActions} pending retention actions
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Compact retention view for mode indicators
 */
const CompactRetentionView: React.FC<{ status: RetentionStatus }> = ({ status }) => {
  const overallHealth = status.health.length > 0
    ? Math.round(status.health.reduce((sum, h) => sum + h.healthScore, 0) / status.health.length)
    : 100;

  const totalPending = status.health.reduce((sum, h) => sum + h.pendingActions, 0);

  return (
    <div className="retention-compact">
      <div 
        className="retention-indicator"
        style={{ backgroundColor: getHealthColor(overallHealth) }}
        title={`Retention Health: ${overallHealth}/100`}
      >
        <span className="retention-icon">🗄️</span>
        {totalPending > 0 && (
          <span className="pending-badge">{totalPending}</span>
        )}
      </div>
    </div>
  );
};

/**
 * Retention policy summary component
 */
export const RetentionPolicySummary: React.FC = () => {
  return (
    <div className="retention-policy-summary">
      <h3>Retention Policies</h3>
      <div className="policy-grid">
        {Object.entries(KB_RETENTION_POLICIES).map(([kbId, policy]) => (
          <div key={kbId} className="policy-card">
            <h4>{policy.kbName}</h4>
            <div className="policy-details">
              <div className="policy-item">
                <span className="policy-label">Retention:</span>
                <span className="policy-value">
                  {getRetentionDisplay(policy.retentionDays)}
                </span>
              </div>
              {policy.isImmutable && (
                <div className="policy-badge immutable">Immutable</div>
              )}
              {policy.tieredStorage && (
                <div className="policy-badge tiered">Tiered Storage</div>
              )}
              {policy.requiresDadApproval && (
                <div className="policy-badge approval">Dad Approval</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Retention action button for manual operations
 */
export const RetentionActionButton: React.FC<{
  kbName: string;
  action: 'purge' | 'archive' | 'verify';
  onAction: () => void;
}> = ({ kbName, action, onAction }) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      await onAction();
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'purge': return '🗑️';
      case 'archive': return '📦';
      case 'verify': return '✅';
    }
  };

  return (
    <button
      className={`retention-action-btn ${action}`}
      onClick={handleAction}
      disabled={loading}
      title={`${action} ${kbName}`}
    >
      {loading ? '⏳' : getActionIcon()}
      <span>{action}</span>
    </button>
  );
};

// CSS styles for the retention monitoring components
const retentionStyles = `
.retention-monitor {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.retention-monitor h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.kb-retention-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.kb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.kb-header h4 {
  margin: 0;
  color: var(--text-primary);
}

.health-score {
  font-weight: 600;
  font-size: 0.875rem;
}

.retention-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stat-group {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  font-weight: 500;
  color: var(--text-primary);
}

.tier-distribution {
  margin: 0.5rem 0;
}

.tier-bar {
  display: flex;
  height: 1.5rem;
  border-radius: 0.25rem;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.tier-segment {
  transition: width 0.3s ease;
}

.schedule-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.schedule-item {
  display: flex;
  justify-content: space-between;
}

.schedule-label {
  color: var(--text-secondary);
}

.schedule-value {
  color: var(--text-primary);
}

.pending-alert {
  padding: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  text-align: center;
}

.retention-compact {
  display: inline-flex;
  align-items: center;
}

.retention-indicator {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  position: relative;
}

.retention-icon {
  font-size: 1rem;
}

.pending-badge {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  background: #ef4444;
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.25rem;
  border-radius: 9999px;
  font-weight: 600;
}

.retention-policy-summary {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
}

.policy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.policy-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 1rem;
}

.policy-card h4 {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.policy-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.policy-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.policy-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  margin-right: 0.25rem;
}

.policy-badge.immutable {
  background: #ddd6fe;
  color: #5b21b6;
}

.policy-badge.tiered {
  background: #dbeafe;
  color: #1e40af;
}

.policy-badge.approval {
  background: #fef3c7;
  color: #92400e;
}

.retention-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.retention-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.retention-action-btn.purge {
  background: #fee2e2;
  color: #991b1b;
}

.retention-action-btn.purge:hover:not(:disabled) {
  background: #fecaca;
}

.retention-action-btn.archive {
  background: #dbeafe;
  color: #1e40af;
}

.retention-action-btn.archive:hover:not(:disabled) {
  background: #bfdbfe;
}

.retention-action-btn.verify {
  background: #d1fae5;
  color: #065f46;
}

.retention-action-btn.verify:hover:not(:disabled) {
  background: #a7f3d0;
}
`;

// Export styles for inclusion in the main stylesheet
export const retentionMonitoringStyles = retentionStyles;