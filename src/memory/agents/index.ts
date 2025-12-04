/**
 * Phoenix Marie Memory Architecture - Agent System Exports
 * 
 * Central export point for all agent-related components.
 */

// Type definitions
export * from './types';

// Agent registry
export { 
  AgentRegistry, 
  AgentRegistryConfig,
  agentRegistry 
} from './registry';

// Permission system
export {
  AgentPermissionMatrix,
  PermissionCheckResult,
  AgentRateLimiter,
  agentPermissions,
  agentRateLimiter
} from './permissions';

// Authentication system
export {
  AgentAuthenticationManager,
  AuthenticationResult,
  TokenValidationResult,
  AuthenticationConfig,
  AuthenticatedContext,
  AuthenticationMiddleware,
  authenticationManager,
  authMiddleware
} from './authentication';

// Middleware system
export {
  AgentPermissionMiddleware,
  MiddlewareResult,
  KBOperationRequest,
  KBMiddlewareFactory,
  agentMiddleware,
  kbMiddlewareFactory,
  mindKBMiddleware,
  bodyKBMiddleware,
  soulKBMiddleware,
  heartKBMiddleware,
  workKBMiddleware,
  threatIntelKBMiddleware
} from './middleware';

// Re-export commonly used types for convenience
export {
  Agent,
  PersonalAgent,
  ProfessionalAgent,
  AgentClassification,
  AgentToken,
  AgentActivity,
  AgentOperation,
  PersonalCapability,
  ClearanceLevel,
  SecuritySpecialization,
  SuspensionReason
} from './types';