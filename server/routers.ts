import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter.js";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import {
  createCompany,
  getCompanyById,
  getCompanyByOwnerId,
  updateCompany,
  createClient,
  getClientsByCompanyId,
  getClientById,
  updateClient,
  deleteClient,
  createFee,
  getFeesByCompanyId,
  getFeesByClientId,
  getFeeById,
  updateFee,
  deleteFee,
  getDashboardStats,
  getNotificationsByUserId,
  markNotificationAsRead,
  deleteNotification,
  deleteNotificationsByUserId,
  generateFeeReceipt,
  generateDueNotifications,
  createCompanyUser,
  deleteCompanyUser,
  getUserById,
  listUsersByCompanyId,
  updateCompanyUser,
  getAppointmentsByUserRange,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} from "./db.js";

const safeText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const documentText = z.string().trim().min(11).max(18).regex(/^[0-9./-]+$/, "Documento inválido");
const cnpjText = z.string().trim().min(14).max(18).regex(/^[0-9./-]+$/, "CNPJ inválido");
const phoneText = z.string().trim().max(30).regex(/^[0-9+()\s.-]*$/, "Telefone inválido").optional();
const moneyText = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Valor inválido").max(18);
const competenceText = z.string().trim().regex(/^\d{4}-\d{2}$/, "Competência inválida");
const dateText = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const timeText = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido");
const logoDataUrl = z.string()
  .max(1_000_000, "Logo muito grande")
  .refine(value => /^data:image\/(png|jpe?g);base64,/i.test(value), "Envie uma logo PNG ou JPG válida.");

function assertCompanyAccess(userCompanyId: number | null | undefined, requestedCompanyId: number) {
  if (!userCompanyId || userCompanyId !== requestedCompanyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado para os dados desta empresa." });
  }
}

async function assertClientAccess(userCompanyId: number | null | undefined, clientId: number) {
  const client = await getClientById(clientId);
  if (!client || !userCompanyId || client.companyId !== userCompanyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence à sua empresa." });
  }
  return client;
}

async function assertFeeAccess(userCompanyId: number | null | undefined, feeId: number) {
  const fee = await getFeeById(feeId);
  if (!fee || !userCompanyId || fee.companyId !== userCompanyId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Honorário não pertence à sua empresa." });
  }
  return fee;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),

  company: router({
    create: adminProcedure
      .input(z.object({
        legalName: safeText(180),
        cnpj: cnpjText,
        address: optionalText(240),
        phone: phoneText,
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este usuário já está vinculado a uma empresa." });
        }
        return createCompany({
          ownerId: ctx.user.id,
          legalName: input.legalName,
          cnpj: input.cnpj,
          address: input.address,
          phone: input.phone,
        });
      }),

    getByOwner: protectedProcedure.query(async ({ ctx }) => {
      const companyByOwner = await getCompanyByOwnerId(ctx.user.id);
      if (companyByOwner) return companyByOwner;

      // TanStack Query não aceita `undefined` como dado de uma query bem-sucedida.
      // Quando o usuário acabou de se cadastrar e ainda não criou/vinculou empresa,
      // retornamos `null` para que a tela de Empresa abra o formulário de cadastro.
      if (!ctx.user.companyId) return null;

      return (await getCompanyById(ctx.user.companyId)) ?? null;
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user.companyId, input);
      return getCompanyById(input);
    }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        legalName: safeText(180).optional(),
        cnpj: cnpjText.optional(),
        address: optionalText(240),
        phone: phoneText,
        logoUrl: logoDataUrl.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCompanyAccess(ctx.user.companyId, input.id);
        const { id, ...data } = input;
        return updateCompany(id, data);
      }),
  }),

  clients: router({
    create: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        name: safeText(180),
        cpfCnpj: documentText,
        email: z.string().trim().email().max(180).optional().or(z.literal("")),
        phone: phoneText,
        address: optionalText(240),
        monthlyFee: moneyText,
        taxRegime: z.enum(["mei", "simples_nacional", "lucro_presumido", "lucro_real"]),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCompanyAccess(ctx.user.companyId, input.companyId);
        return createClient({
          companyId: input.companyId,
          name: input.name,
          cpfCnpj: input.cpfCnpj,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          monthlyFee: input.monthlyFee,
          taxRegime: input.taxRegime,
        });
      }),

    listByCompany: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user.companyId, input);
      return getClientsByCompanyId(input);
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return assertClientAccess(ctx.user.companyId, input);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: safeText(180).optional(),
        cpfCnpj: documentText.optional(),
        email: z.string().trim().email().max(180).optional().or(z.literal("")),
        phone: phoneText,
        address: optionalText(240),
        monthlyFee: moneyText.optional(),
        taxRegime: z.enum(["mei", "simples_nacional", "lucro_presumido", "lucro_real"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertClientAccess(ctx.user.companyId, input.id);
        const { id, ...data } = input;
        return updateClient(id, data);
      }),

    delete: adminProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.user.companyId, input);
      return deleteClient(input);
    }),
  }),

  fees: router({
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        companyId: z.number(),
        competence: competenceText,
        amount: moneyText,
        dueDate: z.date(),
        paymentMethod: z.enum(["pix", "dinheiro", "boleto", "cartao_credito", "cartao_debito", "transferencia", "outros"]).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertCompanyAccess(ctx.user.companyId, input.companyId);
        await assertClientAccess(ctx.user.companyId, input.clientId);
        return createFee({
          clientId: input.clientId,
          companyId: input.companyId,
          competence: input.competence,
          amount: input.amount,
          dueDate: input.dueDate,
          paymentMethod: input.paymentMethod ?? null,
        });
      }),

    listByCompany: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      assertCompanyAccess(ctx.user.companyId, input);
      return getFeesByCompanyId(input);
    }),

    listByClient: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      await assertClientAccess(ctx.user.companyId, input);
      return getFeesByClientId(input);
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ ctx, input }) => {
      return assertFeeAccess(ctx.user.companyId, input);
    }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientId: z.number().optional(),
        competence: competenceText.optional(),
        amount: moneyText.optional(),
        status: z.enum(["pending", "paid", "overdue"]).optional(),
        dueDate: z.date().optional(),
        paidDate: z.date().nullable().optional(),
        paymentMethod: z.enum(["pix", "dinheiro", "boleto", "cartao_credito", "cartao_debito", "transferencia", "outros"]).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertFeeAccess(ctx.user.companyId, input.id);
        if (input.clientId) await assertClientAccess(ctx.user.companyId, input.clientId);
        const { id, ...data } = input;
        return updateFee(id, data);
      }),

    delete: adminProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      await assertFeeAccess(ctx.user.companyId, input);
      return deleteFee(input);
    }),
  }),

  dashboardStats: router({
    getStats: protectedProcedure
      .input(z.object({ companyId: z.number(), month: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        assertCompanyAccess(ctx.user.companyId, input.companyId);
        return getDashboardStats(input.companyId, input.month);
      }),
  }),

  appointments: router({
    listByRange: protectedProcedure
      .input(z.object({ from: dateText, to: dateText }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.companyId) return [];
        return getAppointmentsByUserRange(ctx.user.id, ctx.user.companyId, input.from, input.to);
      }),

    create: protectedProcedure
      .input(z.object({
        title: safeText(120),
        clientName: optionalText(180),
        clientPhone: phoneText,
        notes: optionalText(1000),
        date: dateText,
        startTime: timeText,
        endTime: timeText,
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre a empresa antes de usar a agenda." });
        return createAppointment({
          userId: ctx.user.id,
          companyId: ctx.user.companyId,
          title: input.title,
          clientName: input.clientName || null,
          clientPhone: input.clientPhone || null,
          notes: input.notes || null,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: safeText(120).optional(),
        clientName: optionalText(180),
        clientPhone: phoneText,
        notes: optionalText(1000),
        date: dateText.optional(),
        startTime: timeText.optional(),
        endTime: timeText.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const appointment = await getAppointmentById(input.id);
        if (!appointment || appointment.userId !== ctx.user.id || appointment.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Agendamento não pertence ao usuário logado." });
        }
        const { id, ...data } = input;
        return updateAppointment(id, {
          ...data,
          clientName: data.clientName !== undefined ? data.clientName || null : undefined,
          clientPhone: data.clientPhone !== undefined ? data.clientPhone || null : undefined,
          notes: data.notes !== undefined ? data.notes || null : undefined,
        });
      }),

    cancel: protectedProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      const appointment = await getAppointmentById(input);
      if (!appointment || appointment.userId !== ctx.user.id || appointment.companyId !== ctx.user.companyId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Agendamento não pertence ao usuário logado." });
      }
      return cancelAppointment(input);
    }),
  }),

  notifications: router({
    listByUser: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.companyId) {
        await generateDueNotifications(ctx.user.companyId, ctx.user.id);
      }
      return getNotificationsByUserId(ctx.user.id);
    }),

    markAsRead: protectedProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      const notifications = await getNotificationsByUserId(ctx.user.id);
      if (!notifications.some(notification => notification.id === input)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Notificação não pertence ao usuário logado." });
      }
      return markNotificationAsRead(input);
    }),

    delete: protectedProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      const notifications = await getNotificationsByUserId(ctx.user.id);
      if (!notifications.some(notification => notification.id === input)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Notificação não pertence ao usuário logado." });
      }
      return deleteNotification(input);
    }),

    clearAll: protectedProcedure.mutation(async ({ ctx }) => {
      return deleteNotificationsByUserId(ctx.user.id);
    }),
  }),

  users: router({
    listByCompany: adminProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return [];
      return listUsersByCompanyId(ctx.user.companyId);
    }),

    create: adminProcedure
      .input(z.object({
        name: safeText(120),
        email: z.string().trim().email().max(180),
        password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(128, "A senha é muito longa."),
        role: z.enum(["admin", "assistant"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre a empresa antes de adicionar usuários." });
        }
        return createCompanyUser({ companyId: ctx.user.companyId, ...input });
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: safeText(120).optional(),
        role: z.enum(["admin", "assistant"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(input.id);
        if (!user || user.companyId !== ctx.user.companyId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não pertence à sua empresa." });
        }
        if (input.id === ctx.user.id && input.role === "assistant") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover sua própria permissão de administrador." });
        }
        const { id, ...data } = input;
        return updateCompanyUser(id, data);
      }),

    delete: adminProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      const user = await getUserById(input);
      if (!user || user.companyId !== ctx.user.companyId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não pertence à sua empresa." });
      }
      if (input === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir seu próprio usuário." });
      }
      const company = ctx.user.companyId ? await getCompanyById(ctx.user.companyId) : undefined;
      if (company?.ownerId === input) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável principal da empresa não pode ser excluído." });
      }
      return deleteCompanyUser(input);
    }),
  }),

  receipts: router({
    generate: protectedProcedure.input(z.number()).mutation(async ({ ctx, input }) => {
      await assertFeeAccess(ctx.user.companyId, input);
      const receiptBuffer = await generateFeeReceipt(input, ctx.user.id);
      return {
        data: receiptBuffer.toString("base64"),
        filename: `recibo-${input}.pdf`,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
