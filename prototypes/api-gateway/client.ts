import { GatewayConfig, GatewayError, VentureType } from './types';

export interface GatewayClientOptions {
  baseUrl: string;
  apiKey?: string;
  jwt?: string;
  timeoutMs?: number;
  retries?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  onIdempotencyReplay?: (request: { path: string; method: string }) => void;
}

export interface GatewayClientRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string>;
  idempotencyKey?: string;
  headers?: Record<string, string>;
}

export interface GatewayClientResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
  fromCache: boolean;
  requestId: string;
  durationMs: number;
}

export class GatewayClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly message: string,
    public readonly requestId: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GatewayClientError';
  }
}

export class GatewayClient {
  private readonly options: Required<Pick<GatewayClientOptions, 'baseUrl' | 'timeoutMs' | 'retries'>> &
    GatewayClientOptions;

  constructor(options: GatewayClientOptions) {
    this.options = {
      timeoutMs: 10000,
      retries: 2,
      ...options,
    };
  }

  setApiKey(apiKey: string) {
    this.options.apiKey = apiKey;
  }

  setJWT(jwt: string) {
    this.options.jwt = jwt;
  }

  async request<T = unknown>(request: GatewayClientRequest): Promise<GatewayClientResponse<T>> {
    const { path, method = 'GET', body, query, idempotencyKey, headers = {} } = request;

    const queryString = query ? `?${new URLSearchParams(query).toString()}` : '';
    const url = `${this.options.baseUrl}${path}${queryString}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ditshego-gateway-client/1.0.0',
      ...headers,
    };

    if (this.options.apiKey) {
      requestHeaders['X-API-Key'] = this.options.apiKey;
    }

    if (this.options.jwt) {
      requestHeaders['Authorization'] = `Bearer ${this.options.jwt}`;
    }

    // Mutations are automatically idempotent: auto-generate a stable key so
    // retries can never double-earn or double-spend across the ecosystem.
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const finalIdempotencyKey = idempotencyKey || (isMutation ? this.generateIdempotencyKey(path, body) : undefined);
    if (finalIdempotencyKey) {
      requestHeaders['Idempotency-Key'] = finalIdempotencyKey;
    }

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= this.options.retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

      try {
        const startedAt = Date.now();
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const responseBody = await response.json();
        const durationMs = Date.now() - startedAt;

        if (response.ok) {
          this.log('info', `[${method}] ${path} → ${response.status} (${durationMs}ms)`);
          return {
            status: response.status,
            body: responseBody as T,
            headers: Object.fromEntries(response.headers.entries()),
            fromCache: response.headers.get('x-cache') === 'HIT',
            requestId: response.headers.get('x-request-id') || '',
            durationMs,
          };
        }

        const error = responseBody as GatewayError;
        this.log('error', `[${method}] ${path} → ${response.status} (${durationMs}ms): ${error.error?.code || 'UNKNOWN'}`);

        if ([401, 403, 404, 409].includes(response.status) || attempts >= this.options.retries) {
          throw new GatewayClientError(
            response.status,
            error.error?.code || 'UNKNOWN',
            error.error?.message || 'Gateway request failed',
            error.error?.requestId || '',
            error.error?.details
          );
        }

        attempts += 1;
        lastError = new Error(`HTTP ${response.status}: ${error.error?.message}`);
      } catch (e) {
        if (e instanceof GatewayClientError) throw e;
        lastError = e instanceof Error ? e : new Error(String(e));
        attempts += 1;
        this.log('warn', `[${method}] ${path} attempt ${attempts} failed: ${lastError.message}`);

        if (attempts <= this.options.retries) {
          await new Promise(r => setTimeout(r, 250 * attempts));
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('Request failed');
  }

  // Helper methods mapped to the venture contracts
  async earnCredits(body: { venture: VentureType; source: string; amount?: number; description: string; idempotencyKey?: string }) {
    return this.request<{ success: boolean; transaction?: unknown }>({
      path: '/api/v1/credits/earn',
      method: 'POST',
      body,
      idempotencyKey: body.idempotencyKey,
    });
  }

  async spendCredits(body: { venture: VentureType; source: string; amount: number; description: string; idempotencyKey?: string }) {
    return this.request<{ success: boolean; transaction?: unknown }>({
      path: '/api/v1/credits/spend',
      method: 'POST',
      body,
      idempotencyKey: body.idempotencyKey,
    });
  }

  async getCreditsBalance() {
    return this.request<{ balance: number; wallets: Array<{ venture: string; balance: number }> }>({
      path: '/api/v1/credits/balance',
    });
  }

  async askTutor(body: { module: string; institution: string; question: string; context?: unknown }) {
    return this.request<{ answer: string; confidence: number; language: string; sources: unknown[] }>({
      path: '/api/v1/tutor',
      method: 'POST',
      body,
    });
  }

  async paperTrade(body: { strategyId: string; symbol: string; action: 'BUY' | 'SELL'; quantity: number; idempotencyKey?: string }) {
    return this.request<{ orderId: string; filled: boolean; price: number; creditsEarned?: number }>({
      path: '/api/v1/trade/paper',
      method: 'POST',
      body,
      idempotencyKey: body.idempotencyKey,
    });
  }

  async searchTalent(body: { criteria: Record<string, unknown>; limit?: number }) {
    return this.request<{ candidates: unknown[]; total: number }>({
      path: '/api/v1/talent/search',
      method: 'POST',
      body,
    });
  }

  async awardTournamentCredits(body: { tournamentId: string; result: string; userIds: number[]; idempotencyKey?: string }) {
    return this.request<{ success: boolean; awarded: boolean }>({
      path: '/api/v1/tournaments/credits',
      method: 'POST',
      body,
      idempotencyKey: body.idempotencyKey,
    });
  }

  async generateContent(body: { contentType: string; topic: string; audience: string }) {
    return this.request<{ contentId: string; title: string; approved: boolean }>({
      path: '/api/v1/content',
      method: 'POST',
      body,
    });
  }

  async getTournaments() {
    return this.request<{ tournaments: unknown[] }>({ path: '/api/v1/tournaments' });
  }

  async getCommunityPosts() {
    return this.request<{ posts: unknown[] }>({ path: '/api/v1/community/posts' });
  }

  private generateIdempotencyKey(path: string, body?: unknown): string {
    const contentHash = typeof body === 'string' ? body : JSON.stringify(body || {});
    let hash = 0;
    for (let i = 0; i < contentHash.length; i++) {
      hash = ((hash << 5) - hash + contentHash.charCodeAt(i)) | 0;
    }
    return `${path.replace(/[^a-z0-9]/gi, '').slice(-24)}-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string) {
    const configured = this.options.logLevel || 'info';
    const order: Record<string, number> = { none: -1, debug: 0, info: 1, warn: 2, error: 3 };
    const levelValue = order[level] ?? 1;
    const configValue = order[configured] ?? 1;
    if (levelValue < configValue) return;

    if (level === 'error') console.error(`[GatewayClient] ${message}`);
    else if (level === 'warn') console.warn(`[GatewayClient] ${message}`);
    else console.log(`[GatewayClient] ${message}`);
  }
}

export function createGatewayClient(options: GatewayClientOptions): GatewayClient {
  return new GatewayClient(options);
}