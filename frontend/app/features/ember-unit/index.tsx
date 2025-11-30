/**
 * Ember Unit Feature Module
 * 
 * Provides components and services for engaging with target systems
 * through controlled security operations.
 */

// Note: During migration, only types and services were fully implemented
// Components will be implemented in a future task

// Types
export * from './types';

// Services
export { emberUnitApi } from './services/emberUnitApi';
export { emberUnitSocket } from './services/emberUnitSocket';

// Component exports to be implemented in a future task
// export { default as EmberUnitDashboard } from './components/EmberUnitDashboard';
// export { default as SkillManifesto } from './components/SkillManifesto';
// export { default as TacticalPlaybook } from './components/TacticalPlaybook';
// export { default as OpportunityEngine } from './components/OpportunityEngine';
// export { default as OperationVisualization } from './components/OperationVisualization';