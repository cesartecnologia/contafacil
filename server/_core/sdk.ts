import type { Request } from "express";
import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";

function readBearerToken(req: Request) {
  const authorization = req.headers.authorization;
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export type AuthenticatedUser = User;

class FirebaseAuthService {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const idToken = readBearerToken(req);
    if (!idToken) throw ForbiddenError("Token de autenticação ausente");

    let decodedToken;
    try {
      const auth = await db.getAdminAuth();
      decodedToken = await auth.verifyIdToken(idToken, true);
    } catch (error) {
      console.warn("[Firebase Auth] Falha ao validar ID token", String(error));
      throw ForbiddenError("Token de autenticação inválido");
    }


    const email = typeof decodedToken.email === "string" ? decodedToken.email : null;
    const name = typeof decodedToken.name === "string" ? decodedToken.name : null;
    const loginMethod = typeof decodedToken.firebase?.sign_in_provider === "string"
      ? decodedToken.firebase.sign_in_provider
      : "firebase";

    await db.upsertUser({
      openId: decodedToken.uid,
      name,
      email,
      loginMethod,
      lastSignedIn: new Date(),
    });

    const user = await db.getUserByOpenId(decodedToken.uid);
    if (!user) throw ForbiddenError("Conta não localizada após autenticação");

    return user;
  }
}

export const sdk = new FirebaseAuthService();
