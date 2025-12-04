/**
 * Ember Unit Feature Module
 * 
 * Provides components and services for engaging with target systems
 * through controlled security operations.
 */

// Types
export * from './types';

// Services
export { emberUnitApi } from './services/emberUnitApi';
export { emberUnitSocket } from './services/emberUnitSocket';

// Components
export { default as EmberUnit } from './components/EmberUnit';
export { default as EmberUnitDashboard } from './components/EmberUnitDashboard';
export { default as TacticalPlaybook } from './components/TacticalPlaybook';
export { default as OpportunityEngine } from './components/OpportunityEngine';
export { default as OperationVisualization } from './components/OperationVisualization';