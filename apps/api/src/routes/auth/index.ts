import { FastifyInstance } from "fastify";
import { registerRegistrationRoutes } from "./registration.js";
import { registerSessionRoutes } from "./session.js";
import { registerTokenRoutes } from "./tokens.js";
import { registerPhoneRoutes } from "./phone.js";
import { registerAccountRoutes } from "./account.js";
import { registerTotpRoutes } from "./totp.js";
import { registerSsoRoutes } from "../sso.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  await registerRegistrationRoutes(app);
  await registerSessionRoutes(app);
  await registerTokenRoutes(app);
  await registerPhoneRoutes(app);
  await registerAccountRoutes(app);
  await registerTotpRoutes(app);
  await registerSsoRoutes(app);
}
