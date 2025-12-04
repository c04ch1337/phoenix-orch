/**
 * Type definitions for mobile conscience gate integration
 * These types define the structure for mobile security and privacy settings
 * that integrate with the backend mobile conscience gate system
 */

/**
 * Mobile context profile for conscience gate evaluation
 */
export interface MobileContextProfile {
  /** HITM (Human in the Middle) level for mobile operations */
  hitmLevel: HitmLevel;
  /** Whether mobile privacy restrictions are exempted */
  mobilePrivacyExempt: boolean;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * HITM (Human in the Middle) level enumeration
 * Determines the level of human oversight required for mobile operations
 */
export enum HitmLevel {
  /** No human oversight required - full automation */
  None = 'none',
  /** Low oversight - automated with human notification */
  Low = 'low',
  /** Medium oversight - human approval required for sensitive operations */
  Medium = 'medium',
  /** High oversight - all operations require explicit human approval */
  High = 'high',
  /** Critical oversight - operations blocked until manual review */
  Critical = 'critical'
}

/**
 * Mobile privacy settings structure
 */
export interface MobilePrivacySettings {
  /** Whether cybersecurity mode is active */
  cybersecurityMode: boolean;
  /** Current mobile privacy level (0-100) */
  privacyLevel: number;
  /** Whether mobile monitoring is enabled */
  monitoringEnabled: boolean;
  /** Whether location tracking is active */
  locationTracking: boolean;
  /** Whether app permissions are restricted */
  appPermissionsRestricted: boolean;
  /** Whether network traffic is being monitored */
  networkMonitoring: boolean;
  /** Whether device encryption is enabled */
  deviceEncryption: boolean;
  /** Whether remote wipe capability is enabled */
  remoteWipeEnabled: boolean;
  /** Last status update timestamp */
  lastUpdate: string;
  /** Additional custom settings */
  customSettings?: Record<string, unknown>;
}

/**
 * Mobile conscience gate request payload
 */
export interface MobileConscienceRequest {
  /** Unique request identifier */
  id: string;
  /** Mobile action being requested */
  action: string;
  /** Tool or service identifier */
  toolId: string;
  /** Request parameters */
  parameters: Record<string, unknown>;
  /** Context metadata for conscience evaluation */
  context: Record<string, string>;
  /** Request timestamp */
  timestamp: string;
  /** Request origin */
  origin: RequestOrigin;
}

/**
 * Mobile conscience gate response
 */
export interface MobileConscienceResponse {
  /** Whether the request was approved */
  approved: boolean;
  /** Reason for approval or denial */
  reason?: string;
  /** Additional constraints or conditions */
  constraints?: string[];
  /** Risk assessment score (0-100) */
  riskScore: number;
  /** Recommended alternative actions */
  alternatives?: string[];
  /** Timestamp of response */
  timestamp: string;
}

/**
 * Request origin types
 */
export enum RequestOrigin {
  /** User-initiated request */
  User = 'user',
  /** System-generated request */
  System = 'system',
  /** Automated process request */
  Automated = 'automated',
  /** External service request */
  External = 'external'
}

/**
 * Mobile device information
 */
export interface MobileDeviceInfo {
  /** Device identifier */
  deviceId: string;
  /** Device manufacturer */
  manufacturer: string;
  /** Device model */
  model: string;
  /** Operating system */
  os: string;
  /** OS version */
  osVersion: string;
  /** Device security patch level */
  securityPatch: string;
  /** Whether device is rooted/jailbroken */
  isRooted: boolean;
  /** Installed security apps */
  securityApps: string[];
  /** Last security scan timestamp */
  lastSecurityScan: string;
}

/**
 * Mobile target for penetration testing functionality
 * Used specifically in cybersecurity mode with unrestricted access
 */
export interface MobileTarget {
  /** Unique target identifier */
  id: string;
  /** Target device name */
  name: string;
  /** Operating system */
  os: string;
  /** Device model */
  model: string;
  /** IP address */
  ip: string;
  /** MAC address */
  mac: string;
  /** Detected vulnerabilities */
  vulnerabilities?: string[];
  /** Security level assessment (0-100, lower is more vulnerable) */
  securityLevel?: number;
  /** Whether device is rooted/jailbroken */
  isRooted?: boolean;
  /** Open ports found during scanning */
  openPorts?: number[];
  /** Current connection status */
  connectionStatus?: string;
}

/**
 * Results of a mobile payload deployment
 */
export interface DeploymentResult {
  /** Whether deployment was successful */
  success: boolean;
  /** Error message if deployment failed */
  error?: string;
  /** Deployment timestamp */
  timestamp: string;
  /** Target device identifier */
  targetId: string;
  /** Additional result data */
  data?: Record<string, unknown>;
}

/**
 * Mobile network information
 */
export interface MobileNetworkInfo {
  /** Current network type */
  networkType: NetworkType;
  /** Network SSID (if WiFi) */
  ssid?: string;
  /** Network security type */
  securityType?: SecurityType;
  /** IP address */
  ipAddress: string;
  /** Whether VPN is active */
  vpnActive: boolean;
  /** VPN provider (if active) */
  vpnProvider?: string;
  /** Network trust level (0-100) */
  trustLevel: number;
}

/**
 * Network types
 */
export enum NetworkType {
  WiFi = 'wifi',
  Cellular = 'cellular',
  Ethernet = 'ethernet',
  Bluetooth = 'bluetooth',
  Unknown = 'unknown'
}

/**
 * Network security types
 */
export enum SecurityType {
  None = 'none',
  WEP = 'wep',
  WPA = 'wpa',
  WPA2 = 'wpa2',
  WPA3 = 'wpa3',
  Enterprise = 'enterprise'
}

/**
 * Mobile security event
 */
export interface MobileSecurityEvent {
  /** Event identifier */
  id: string;
  /** Event type */
  type: SecurityEventType;
  /** Event severity */
  severity: SecuritySeverity;
  /** Event description */
  description: string;
  /** Affected component */
  component: string;
  /** Event timestamp */
  timestamp: string;
  /** Whether event was resolved */
  resolved: boolean;
  /** Resolution timestamp (if resolved) */
  resolvedAt?: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Security event types
 */
export enum SecurityEventType {
  IntrusionAttempt = 'intrusion_attempt',
  DataBreach = 'data_breach',
  PermissionViolation = 'permission_violation',
  NetworkAnomaly = 'network_anomaly',
  DeviceTampering = 'device_tampering',
  AppMisbehavior = 'app_misbehavior',
  ConfigurationChange = 'configuration_change',
  PrivacyViolation = 'privacy_violation'
}

/**
 * Security event severity levels
 */
export enum SecuritySeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}