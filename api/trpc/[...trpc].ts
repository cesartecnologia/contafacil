import { createHttpApp } from "../../server/_core/httpApp";

// A Vercel executa este handler como Function para todas as rotas /api/trpc/*.
// O app Express reaproveita exatamente os mesmos middlewares usados localmente.
const app = createHttpApp();

export default app;
