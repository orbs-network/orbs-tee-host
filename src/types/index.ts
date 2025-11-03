/**
 * Type definitions for ORBS TEE Host
 */

// Re-export protocol types (will be imported from orbs-tee-protocol package)
// TODO: Add orbs-tee-protocol package when available
export interface TeeRequest {
  id: string;
  method: string;
  params: any;
  timestamp: number;
}

export interface TeeResponse {
  id: string;
  success: boolean;
  data?: any;
  signature?: string;
  error?: string;
}

// Configuration types
export interface Config {
  vsock: VsockConfig;
  l3: L3Config;
  api: ApiConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
}

export interface VsockConfig {
  cid: number;
  port: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface L3Config {
  endpoint: string;  // Single endpoint (can be env var or config)
  timeoutMs: number;
  retryAttempts: number;
}

export interface ApiConfig {
  host: string;
  port: number;
  tlsEnabled: boolean;
  tlsCert?: string;
  tlsKey?: string;
}

export interface AuthConfig {
  enabled: boolean;
  rateLimitingEnabled: boolean;
}

export interface LoggingConfig {
  level: string;
  format: string;
}

// Host-specific types
export interface DAppRequest {
  method: string;
  params: any;
  tappId?: string;
  signature?: string;
  timestamp: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  enclaveConnected: boolean;
  l3Reachable: boolean;
  uptimeSeconds: number;
}

export interface StatusResponse extends HealthStatus {
  hostVersion: string;
  enclavePublicKey?: string;
  l3GuardiansReachable: number;
  requestsProcessed: number;
}

// L3 types
export interface AttestationBundle {
  attestationDoc: Buffer;
  certificateChain: Buffer[];
  enclavePublicKey: string;
  tappId: string;
}

export interface AttestationSubmission {
  attestationId: string;
  submissionTime: Date;
  status: 'submitted' | 'pending' | 'verified' | 'failed';
}

export interface ConsensusStatus {
  attestationId: string;
  status: 'pending' | 'achieved' | 'failed' | 'disputed';
  guardiansVerified: number;
  totalGuardians: number;
}
