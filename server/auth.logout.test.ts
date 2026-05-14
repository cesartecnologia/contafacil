import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import type { TrpcContext } from "./_core/context.js";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "firebase-uid",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "password",
    role: "assistant",
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("returns success; client-side Firebase Auth performs the sign-out", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});
