import crypto from 'crypto';
import { VentureType, VentureCredentials, GatewayContext } from './types';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly apiKeySecret: string;

  constructor(jwtSecret: string, apiKeySecret: string) {
    this.jwtSecret = jwtSecret;
    this.apiKeySecret = apiKeySecret;
  }

  createVentureCredentials(venture: VentureType, scopes: string[], ttlHours = 24): VentureCredentials {
    const apiKey = this.generateApiKey(venture);
    return {
      venture,
      apiKey,
      scopes,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 3600000),
    };
  }

  generateApiKey(venture: VentureType): string {
    const payload = `${venture}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
    const signature = this.sign(payload);
    return Buffer.from(JSON.stringify({ p: payload, s: signature })).toString('base64url');
  }

  verifyApiKey(apiKey: string): { venture: VentureType; scopes: string[]; issuedAt: Date; expiresAt: Date } | null {
    try {
      const decoded = JSON.parse(Buffer.from(apiKey, 'base64url').toString('utf8'));
      const payload = decoded.p;
      const signature = decoded.s;

      const expected = this.sign(payload);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return null;
      }

      const [venture, issuedAtMs] = payload.split(':');
      const issuedAt = new Date(parseInt(issuedAtMs));
      const expiresAt = new Date(issuedAt.getTime() + 24 * 3600000);

      if (expiresAt < new Date()) {
        return null;
      }

      return { venture, scopes: [], issuedAt, expiresAt };
    } catch {
      return null;
    }
  }

  signJWT(context: GatewayContext): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: context.userId,
      venture: context.venture,
      service: context.service,
      scopes: context.scopes,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signJWTData(`${headerB64}.${payloadB64}`);

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  verifyJWT(token: string): GatewayContext | null {
    try {
      const [headerB64, payloadB64, signature] = token.split('.');
      if (!headerB64 || !payloadB64 || !signature) return null;

      const expected = this.signJWTData(`${headerB64}.${payloadB64}`);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (payload.exp * 1000 < Date.now()) return null;

      return {
        userId: payload.sub,
        venture: payload.venture,
        service: payload.service,
        scopes: payload.scopes,
        requestId: crypto.randomUUID(),
        startedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  verifyHMACRequest(venture: VentureType, body: string, signature: string): boolean {
    const expected = this.signHMAC(venture, body);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private sign(payload: string): string {
    return crypto.createHmac('sha256', this.apiKeySecret).update(payload).digest('hex');
  }

  private signHMAC(venture: VentureType, body: string): string {
    return crypto.createHmac('sha256', this.apiKeySecret).update(`${venture}:${body}`).digest('hex');
  }

  private signJWTData(data: string): string {
    return crypto.createHmac('sha256', this.jwtSecret).update(data).digest('base64url');
  }
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function extractApiKey(headers: Record<string, string>): string | null {
  return headers['x-api-key'] || null;
}

export function extractHMAC(headers: Record<string, string>): string | null {
  return headers['x-signature'] || null;
}

export function verifyRequiredScopes(scopes: string[], required: string[]): boolean {
  return required.every(scope => scopes.includes(scope));
}