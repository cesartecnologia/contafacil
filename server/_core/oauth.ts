import type { Express } from "express";

/**
 * O fluxo OAuth antigo foi substituído por Firebase Authentication.
 * Mantemos este stub apenas para evitar imports quebrados em forks antigos.
 */
export function registerOAuthRoutes(_app: Express) {
  return;
}
