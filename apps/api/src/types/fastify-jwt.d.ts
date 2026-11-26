import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      planType: string;
      planStatus: string;
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      verificationLevel: string;
      isMinor?: boolean;
      institutionId?: string | null;
      permissions?: string[];
    };
    user: {
      sub: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      planType: string;
      planStatus: string;
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      verificationLevel: string;
      isMinor?: boolean;
      institutionId?: string | null;
      permissions?: string[];
    };
  }
}
