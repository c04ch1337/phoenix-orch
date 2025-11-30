/**
 * Cipher Guard Feature Module
 *
 * Provides security and threat monitoring components for Phoenix system
 * This module includes components for monitoring and responding to security threats,
 * visualizing defense strategies, and generating security reports.
 */

// Currently migrating component exports
// Only DefenseDashboard is fully implemented, others will be added in future tasks
export { default as DefenseDashboard } from './components/DefenseDashboard';

// Export all the types
export * from './types';

// Note: The following components will be implemented as part of the migration:
// - CipherGuardPage
// - SkillManifesto
// - StrategicDefenseMatrix
// - VulnerabilityDefenseMap
// - ActiveDefensesPanel
// - IncidentDashboard
// - EvidenceGallery
// - ReportingConsole