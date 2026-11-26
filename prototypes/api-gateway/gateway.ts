import { createServer, IncomingMessage, ServerResponse } from 'http';
import { GatewayConfig, GatewayContext, GatewayRequest, GatewayResponse, GatewayError, GatewayErrorCode, GATEWAY_ERROR_CODES, GatewayRoute, VentureService, VentureType } from './types';
import { AuthService, extractBearerToken, extractApiKey, verifyRequiredScopes } from './auth';
import { RateLimiter, ResponseCache } from './rate-limiter';
import { buildGatewayConfig } from './service-registry';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export class GatewayServer {
  private readonly config: GatewayConfig;
  private readonly auth: AuthService;
  private readonly rateLimiter: RateLimiter;
  private readonly cache: ResponseCache;
  private readonly server: ReturnType<typeof createServer>;
  private readonly healthChecks = new Map<string, { healthy: boolean; lastCheck: Date; latencyMs: number }>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.auth = new AuthService(config.jwtSecret, config.apiKeySecret);
    this.rateLimiter = new RateLimiter(config.defaultRateLimit);
    this.cache = new ResponseCache();
    this.server = createServer((req, res) => this.handleRequest(req, res));

    this.cleanupInterval = setInterval(() => this.rateLimiter.cleanup(), 60000);
    this.cleanupInterval.unref();
  }

  start(): void {
    this.server.listen(this.config.port, () => {
      console.log(`[Gateway] Ditshego Venture API Gateway listening on port ${this.config.port} (${this.config.environment})`);
      console.log(`[Gateway] Registered ventures: ${Object.keys(this.config.ventures).length}`);
    });
  }

  stop(): void {
    clearInterval(this.cleanupInterval);
    this.server.close();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const method = req.method as GatewayRequest['method'];
      const path = url.pathname;

      if (path === '/health') {
        return this.sendJson(res, 200, { status: 'ok', requestId, ventures: this.getHealthSummary() });
      }

      const body = await this.readBody(req);

      const context = await this.authenticate(req, requestId);
      if (!context) {
        return this.sendError(res, 'UNAUTHORIZED', 'Invalid or missing credentials', requestId, startedAt);
      }

      const route = this.findRoute(context.venture, path, method);
      if (!route) {
        return this.sendError(res, 'NOT_FOUND', `No route for ${method} ${path} in venture ${context.venture}`, requestId, startedAt);
      }

      if (route.scope && !verifyRequiredScopes(this.effectiveScopes(context), [route.scope])) {
        return this.sendError(res, 'UNAUTHORIZED', `Missing required scope: ${route.scope}`, requestId, startedAt);
      }

      const rateCheck = this.rateLimiter.check(context, route.rateLimit);
      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', Math.ceil(rateCheck.retryAfterMs / 1000));
        return this.sendError(res, 'RATE_LIMITED', 'Rate limit exceeded', requestId, startedAt, { retryAfterMs: rateCheck.retryAfterMs });
      }

      if (route.requiresIdempotencyKey && !req.headers['idempotency-key']) {
        return this.sendError(res, 'VALIDATION_ERROR', 'Idempotency-Key header required', requestId, startedAt);
      }

      const gatewayRequest: GatewayRequest = {
        method,
        path,
        query: Object.fromEntries(url.searchParams),
        headers: req.headers as Record<string, string>,
        body: body ? JSON.parse(body) : undefined,
        context: {
          ...context,
          requestId,
          startedAt,
        },
      };

      const response = await this.route(gatewayRequest, route);
      this.sendJson(res, response.status, response.body, {
        ...response.headers,
        'x-request-id': requestId,
        'x-venture': context.venture,
        'x-cache': response.fromCache ? 'HIT' : 'MISS',
      });

      this.logAudit(requestId, context, path, method, response.status, startedAt, response.fromCache);
    } catch (error) {
      console.error('[Gateway] Unhandled error:', error);
      this.sendError(res, 'UPSTREAM_ERROR', 'Internal gateway error', requestId, startedAt);
    }
  }

  private async authenticate(req: IncomingMessage, requestId: string): Promise<GatewayContext | null> {
    const headers = req.headers as Record<string, string>;

    const jwt = extractBearerToken(headers['authorization']);
    if (jwt) {
      return this.auth.verifyJWT(jwt);
    }

    const apiKey = extractApiKey(headers);
    if (apiKey) {
      const credentials = this.auth.verifyApiKey(apiKey);
      if (credentials) {
        const service = this.config.ventures[`${credentials.venture.toLowerCase()}.ventures.ditshego.za`];
        if (!service) return null;

        return {
          userId: undefined,
          venture: credentials.venture,
          service: `${credentials.venture.toLowerCase()}-service`,
          scopes: service.scopes,
          requestId,
          startedAt: Date.now(),
        };
      }
      return null;
    }

    return null;
  }

  private findRoute(venture: VentureType, path: string, method: string): GatewayRoute | null {
    const callerService = Object.values(this.config.ventures).find(v => v.venture === venture);
    if (!callerService) return null;

    const services = Object.values(this.config.ventures);

    for (const service of services) {
      const isOwnService = service.venture === venture;
      const hasGrant = callerService.grants?.some(g => g.venture === service.venture && g.routes.includes(path));

      if (!isOwnService && !hasGrant) continue;

      const route = service.routes.find(r =>
        r.methods.includes(method as GatewayRoute['methods'][number]) &&
        this.matchPath(r.path, path)
      );

      if (route) {
        if (!isOwnService) {
          this.logGrant(venture, service.venture, path);
        }
        return route;
      }
    }

    return null;
  }

  private effectiveScopes(context: GatewayContext): string[] {
    const service = Object.values(this.config.ventures).find(v => v.venture === context.venture);
    if (!service) return context.scopes;

    const grantScopes = (service.grants || []).flatMap(g => g.scopes);
    return [...new Set([...context.scopes, ...grantScopes])];
  }

  private logGrant(caller: VentureType, target: VentureType, path: string) {
    console.log(`[Gateway][grant] ${caller} → ${target} via Ludo grant: ${path}`);
  }

  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return false;

    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true;
      return part === pathParts[i];
    });
  }

  private async route(request: GatewayRequest, route: GatewayRoute): Promise<GatewayResponse> {
    const cacheKey = route.caching?.enabled
      ? this.cache.buildKey(request.context.venture, request.path, request.query)
      : undefined;

    if (route.caching?.enabled && route.methods.includes('GET')) {
      const cached = this.cache.get(cacheKey!);
      if (cached) {
        return {
          status: 200,
          body: cached.body,
          fromCache: true,
          cacheKey,
          requestId: request.context.requestId,
          durationMs: Date.now() - request.context.startedAt,
        };
      }
    }

    // In a real deployment, this would proxy to the upstream venture service.
    // This is a mock that simulates upstream routing for the prototype.
    const upstreamResponse = await this.callUpstream(request, route);

    if (route.caching?.enabled && upstreamResponse.status === 200 && route.methods.includes('GET')) {
      this.cache.set(cacheKey!, upstreamResponse.body, route.caching.ttlSeconds);
    }

    return {
      status: upstreamResponse.status,
      body: upstreamResponse.body,
      cacheKey,
      requestId: request.context.requestId,
      durationMs: Date.now() - request.context.startedAt,
    };
  }

  private async callUpstream(request: GatewayRequest, route: GatewayRoute): Promise<{ status: number; body: unknown }> {
    // Mock upstream responses per service for the prototype.
    // In production this becomes: fetch(targetServiceUrl + targetPath, { method, headers, body })
    const service = route.targetService;

    switch (service) {
      case 'scholar-credits':
        return this.mockCreditsResponse(route, request);
      case 'aura-tutor':
        return this.mockTutorResponse(request);
      case 'sphere-trading':
        return this.mockPaperTradeResponse(request);
      case 'npc-talent':
        return this.mockTalentResponse(request);
      case 'v4ntag3-credits':
        return { status: 200, body: { success: true, awarded: true, message: 'Credits awarded to tournament participants' } };
      case 'scene-content':
        return this.mockContentResponse(request);
      default:
        return {
          status: 200,
          body: {
            success: true,
            service,
            path: route.targetPath,
            message: `Mock response from ${service}`,
            requestId: request.context.requestId,
            simulated: true,
          },
        };
    }
  }

  private mockCreditsResponse(route: GatewayRoute, request: GatewayRequest): { status: number; body: unknown } {
    switch (route.targetPath) {
      case '/balance': {
        return {
          status: 200,
          body: {
            success: true,
            balance: 1240,
            wallets: [
              { venture: 'SCHOOL', balance: 1240 },
              { venture: 'SPHERE', balance: 350 },
              { venture: 'V4NTAG3', balance: 500 },
            ],
            lifetimeEarned: 5240,
            lifetimeSpent: 4000,
          },
        };
      }
      case '/earn':
      case '/spend': {
        return {
          status: 200,
          body: {
            success: true,
            transaction: {
              id: crypto.randomUUID(),
              userId: request.context.userId,
              venture: request.context.venture,
              type: route.targetPath === '/earn' ? 'EARN' : 'SPEND',
              amount: (request.body as any)?.amount || 0,
              balanceBefore: 1000,
              balanceAfter: 1000 + ((request.body as any)?.amount || 0),
              description: (request.body as any)?.description,
              processedAt: new Date().toISOString(),
            },
          },
        };
      }
      default:
        return { status: 200, body: { success: true } };
    }
  }

  private mockTutorResponse(request: GatewayRequest): { status: number; body: unknown } {
    const { module, question, institution } = (request.body as any) || {};
    return {
      status: 200,
      body: {
        success: true,
        answer: `Mocked AURA response for "${question}" in ${module} (${institution}). In production this hits the AURA LLM endpoint.`,
        confidence: 0.87,
        language: 'en-ZA',
        creditsEarned: 5,
        simulated: true,
      },
    };
  }

  private mockPaperTradeResponse(request: GatewayRequest): { status: number; body: unknown } {
    const { symbol, action, quantity } = (request.body as any) || {};
    return {
      status: 200,
      body: {
        orderId: crypto.randomUUID(),
        filled: true,
        price: 142.50,
        symbol,
        action,
        quantity,
        timestamp: new Date().toISOString(),
        creditsEarned: action === 'BUY' ? 10 : 0,
        simulated: true,
      },
    };
  }

  private mockTalentResponse(request: GatewayRequest): { status: number; body: unknown } {
    const { criteria } = (request.body as any) || {};
    return {
      status: 200,
      body: {
        candidates: [
          { userId: 1, name: 'Candidate A', institution: criteria?.institution || 'NWU', degree: criteria?.degree || 'BSc', year: criteria?.year || 2, scholarCredits: 4500, strengths: ['Physics', 'Math'], modules: ['PHYS111', 'MATH112'] },
          { userId: 2, name: 'Candidate B', institution: criteria?.institution || 'NWU', degree: criteria?.degree || 'BCom', year: criteria?.year || 3, scholarCredits: 3800, strengths: ['Accounting', 'Finance'], modules: ['ACCC111', 'FINM311'] },
          { userId: 3, name: 'Candidate C', institution: criteria?.institution || 'NWU', degree: criteria?.degree || 'BSc', year: criteria?.year || 4, scholarCredits: 6200, strengths: ['CompSci', 'AI'], modules: ['CMPG211', 'CMPG311'] },
        ],
        total: 3,
        simulated: true,
      },
    };
  }

  private mockContentResponse(request: GatewayRequest): { status: number; body: unknown } {
    const { topic, contentType, audience } = (request.body as any) || {};
    return {
      status: 200,
      body: {
        contentId: crypto.randomUUID(),
        title: `Mocked SCENE ${contentType} on: ${topic}`,
        body: `This is a mocked ${contentType} for the ${audience} audience about ${topic}. In production, SCENE Media's BrandOS generates this.`,
        suggestedPlatforms: ['Instagram', 'TikTok', 'LinkedIn'],
        approved: false,
        simulated: true,
      },
    };
  }

  private getHealthSummary(): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    for (const [name, service] of Object.entries(this.config.ventures)) {
      summary[service.venture] = {
        status: service.status,
        routes: service.routes.length,
        healthy: this.healthChecks.get(service.venture)?.healthy ?? service.status === 'live',
      };
    }
    return summary;
  }

  private logAudit(requestId: string, context: GatewayContext, path: string, method: string, status: number, startedAt: number, fromCache?: boolean) {
    console.log(`[Gateway][${requestId}] ${method} ${path} → ${status} | venture=${context.venture} | service=${context.service} | ${Date.now() - startedAt}ms | cache=${fromCache ? 'HIT' : 'MISS'}`);
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      let size = 0;

      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          reject(new Error('Body too large'));
          req.destroy();
          return;
        }
        body += chunk;
      });

      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  private sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      ...headers,
    });
    res.end(JSON.stringify(body));
  }

  private sendError(res: ServerResponse, code: GatewayErrorCode, message: string, requestId: string, startedAt: number, details?: unknown) {
    const errorBody: GatewayError = {
      error: {
        code,
        message,
        requestId,
        details,
      },
    };
    const statusMap: Partial<Record<GatewayErrorCode, number>> = {
      [GATEWAY_ERROR_CODES.UNAUTHORIZED]: 401,
      [GATEWAY_ERROR_CODES.INVALID_SIGNATURE]: 401,
      [GATEWAY_ERROR_CODES.RATE_LIMITED]: 429,
      [GATEWAY_ERROR_CODES.NOT_FOUND]: 404,
      [GATEWAY_ERROR_CODES.UPSTREAM_ERROR]: 502,
      [GATEWAY_ERROR_CODES.TIMEOUT]: 504,
      [GATEWAY_ERROR_CODES.VALIDATION_ERROR]: 400,
      [GATEWAY_ERROR_CODES.SERVICE_DISCOVERY_FAILED]: 503,
      [GATEWAY_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 409,
      [GATEWAY_ERROR_CODES.VENTURE_NOT_ENABLED]: 403,
    };
    this.sendJson(res, statusMap[code] || 500, errorBody, {
      'x-request-id': requestId,
      'x-duration-ms': String(Date.now() - startedAt),
    });
  }
}

// Auto-start when run directly
if (require.main === module) {
  const config = buildGatewayConfig();
  const gateway = new GatewayServer(config);
  gateway.start();
}

export function createGateway(config?: GatewayConfig): GatewayServer {
  return new GatewayServer(config || buildGatewayConfig());
}

// Re-export types for SDK consumers
export type { GatewayConfig, GatewayContext, GatewayRequest, GatewayResponse, GatewayRoute, VentureService, VentureType } from './types';