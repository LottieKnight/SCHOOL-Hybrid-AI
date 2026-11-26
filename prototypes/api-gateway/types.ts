export type VentureType =
  | 'SCHOOL'
  | 'AURA'
  | 'SPHERE'
  | 'NPC'
  | 'ROCKIT'
  | 'SCENE'
  | 'LOGISTICS'
  | 'V4NTAG3'
  | 'DITSHGO_VENTURES';

export type VentureStatus = 'live' | 'beta' | 'roadmap' | 'planning';

export interface VentureGrant {
  venture: VentureType;
  routes: string[];
  scopes: string[];
}

export interface VentureService {
  venture: VentureType;
  status: VentureStatus;
  baseUrl: string;
  apiKeyRequired: boolean;
  scopes: string[];
  routes: GatewayRoute[];
  grants?: VentureGrant[];
}

export interface GatewayRoute {
  path: string;
  methods: HTTPMethod[];
  targetService: string;
  targetPath: string;
  scope: string;
  rateLimit: RateLimitConfig;
  caching?: CacheConfig;
  transform?: TransformConfig;
  requiresIdempotencyKey?: boolean;
}

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  scope?: 'user' | 'venture' | 'global';
}

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  store: 'memory' | 'redis';
}

export interface TransformConfig {
  request?: RequestTransform;
  response?: ResponseTransform;
}

export interface RequestTransform {
  type: 'rename' | 'add' | 'remove' | 'map';
  field?: string;
  to?: string;
  value?: unknown;
  mapping?: Record<string, string>;
}

export interface ResponseTransform {
  type: 'wrap' | 'unwrap' | 'rename' | 'paginate';
  field?: string;
  to?: string;
}

export interface GatewayContext {
  userId?: number;
  venture: VentureType;
  service: string;
  scopes: string[];
  requestId: string;
  startedAt: number;
  rateLimit?: RateLimitConfig;
}

export interface GatewayRequest {
  method: HTTPMethod;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
  context: GatewayContext;
}

export interface GatewayResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  cached?: boolean;
  fromCache?: boolean;
  cacheKey?: string;
  requestId: string;
  durationMs: number;
}

export interface VentureCredentials {
  venture: VentureType;
  apiKey: string;
  scopes: string[];
  issuedAt: Date;
  expiresAt: Date;
}

export interface GatewayConfig {
  port: number;
  environment: 'development' | 'staging' | 'production';
  ventures: Record<string, VentureService>;
  jwtSecret: string;
  apiKeySecret: string;
  defaultRateLimit: RateLimitConfig;
  redisUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ServiceDiscoveryEntry {
  service: string;
  venture: VentureType;
  healthy: boolean;
  lastHealthCheck: Date;
  latencyMs: number;
  version: string;
}

export interface AuditEntry {
  requestId: string;
  venture: VentureType;
  service: string;
  path: string;
  method: HTTPMethod;
  userId?: number;
  status: number;
  durationMs: number;
  fromCache?: boolean;
  timestamp: Date;
}

// Standard error response shape across all ventures
export interface GatewayError {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

// Contract for SCHOOL -> AURA (AI tutor queries)
export interface AuraTutorRequest {
  module: string;
  institution: string;
  question: string;
  context?: {
    pastPaperId?: string;
    chapter?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
}

export interface AuraTutorResponse {
  answer: string;
  confidence: number;
  language: string;
  sources: Array<{ title: string; url: string }>;
  suggestedFollowups: string[];
  creditsEarned?: number;
  cached?: boolean;
}

// Contract for NPC -> SCHOOL (incubator talent discovery)
export interface NpcTalentRequest {
  criteria: {
    institution: string;
    degree: string;
    year: number;
    minimumCredits: number;
    skills: string[];
  };
  limit?: number;
}

export interface NpcTalentResponse {
  candidates: Array<{
    userId: number;
    name: string;
    institution: string;
    degree: string;
    year: number;
    scholarCredits: number;
    strengths: string[];
    modules: string[];
  }>;
  total: number;
}

// Contract for SCHOOL -> SPHERE (financial literacy / paper trading)
export interface SpherePaperTradeRequest {
  userId: number;
  strategyId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
}

export interface SpherePaperTradeResponse {
  orderId: string;
  filled: boolean;
  price: number;
  timestamp: Date;
  creditsEarned?: number;
}

// Contract for V4NTAG3 -> SCHOOL (tournament credits)
export interface V4ntag3CreditRequest {
  tournamentId: string;
  result: 'win' | 'placement' | 'participation';
  userIds: number[];
}

// Contract for SCHOOL -> SCENE (media/content)
export interface SceneContentRequest {
  contentType: 'article' | 'social' | 'newsletter' | 'press_release';
  topic: string;
  audience: 'students' | 'parents' | 'educators' | 'investors';
  brandTone?: 'direct' | 'warm' | 'professional';
}

export interface SceneContentResponse {
  contentId: string;
  title: string;
  body: string;
  suggestedPlatforms: string[];
  approved: boolean;
}

// Contract for ROCKIT -> SCHOOL (music education)
export interface RockitRequest {
  userId: number;
  contentType: 'lesson' | 'masterclass' | 'audition';
  genre: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
}

export interface RockitResponse {
  sessionId: string;
  scheduled: boolean;
  creditsEarned?: number;
}

// Contract for LOGISTICS -> SCHOOL (marketplace delivery)
export interface LogisticsQuoteRequest {
  origin: string;
  destination: string;
  weightKg: number;
  dimensions: { length: number; width: number; height: number };
  service: 'standard' | 'express' | 'campus';
}

export interface LogisticsQuoteResponse {
  quoteId: string;
  price: number;
  currency: 'ZAR';
  estimatedDays: number;
  courier: string;
}

export const GATEWAY_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  TIMEOUT: 'TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVICE_DISCOVERY_FAILED: 'SERVICE_DISCOVERY_FAILED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  VENTURE_NOT_ENABLED: 'VENTURE_NOT_ENABLED',
} as const;

export type GatewayErrorCode = typeof GATEWAY_ERROR_CODES[keyof typeof GATEWAY_ERROR_CODES];