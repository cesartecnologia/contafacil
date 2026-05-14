import dotenv from "dotenv";

// Em desenvolvimento, o Vite já lê .env.local no frontend.
// O backend também precisa ler o mesmo arquivo para validar os tokens Firebase Admin.
dotenv.config({ path: ".env.local" });
dotenv.config();
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const API_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const API_RATE_LIMIT_MAX_REQUESTS = 360;
const apiRateLimits = new Map<string, { count: number; resetAt: number }>();

function applySecurityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;"
    );
  }
  next();
}

function apiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const rawIp = req.ip || req.socket.remoteAddress || "unknown";
  const key = rawIp.replace(/^::ffff:/, "");
  if (apiRateLimits.size > 5000) {
    for (const [storedKey, value] of apiRateLimits) {
      if (value.resetAt <= now) apiRateLimits.delete(storedKey);
    }
  }

  const existing = apiRateLimits.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + API_RATE_LIMIT_WINDOW_MS }
    : existing;

  bucket.count += 1;
  apiRateLimits.set(key, bucket);

  if (bucket.count > API_RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: "Muitas requisições. Aguarde alguns instantes e tente novamente." });
    return;
  }

  next();
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Limites menores reduzem a superfície para abuso e ainda comportam o logotipo em Data URL.
  app.disable("x-powered-by");
  app.use(applySecurityHeaders);
  app.use(express.json({ limit: "3mb" }));
  app.use(express.urlencoded({ limit: "3mb", extended: true }));
  // tRPC API
  app.use(
    "/api/trpc",
    apiRateLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
