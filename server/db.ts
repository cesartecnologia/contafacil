import admin from "firebase-admin";
import { ENV } from "./_core/env.js";
import { generateReceipt, getAmountInWords } from "./_core/receiptGenerator.js";
import type {
  InsertUser,
  User,
  UserRole,
  Company,
  InsertCompany,
  Client,
  InsertClient,
  Fee,
  InsertFee,
  Service,
  InsertService,
  Notification,
  InsertNotification,
  Appointment,
  InsertAppointment,
} from "../drizzle/schema.js";

type CollectionName = "users" | "companies" | "clients" | "fees" | "services" | "notifications" | "appointments" | "counters";
type AnyRecord = Record<string, any>;

let firestore: admin.firestore.Firestore | null = null;

function normalizePrivateKey(value: string | undefined) {
  if (!value) return "";

  let key = value.trim();

  // Aceita tanto .env local com aspas quanto Vercel sem aspas.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n");

  // Proteção extra para importações que transformaram quebras em espaços.
  if (!key.includes("\n") && key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) {
    key = key
      .replace(/-----BEGIN PRIVATE KEY-----\s*/, "-----BEGIN PRIVATE KEY-----\n")
      .replace(/\s*-----END PRIVATE KEY-----/, "\n-----END PRIVATE KEY-----\n");
  }

  return key;
}

function getFirebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase não configurado. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no ambiente.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

export async function getDb() {
  if (firestore) return firestore;

  const { projectId, clientEmail, privateKey } = getFirebaseConfig();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  firestore = admin.firestore();
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

export async function getAdminAuth() {
  await getDb();
  return admin.auth();
}

function now() {
  return new Date();
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeStoredRole(role: unknown, companyId: number | null | undefined): UserRole {
  if (role === "admin") return "admin";
  if (role === "assistant") return "assistant";
  // Compatibilidade com registros criados antes da troca de nomenclatura.
  if (role === "user") return companyId ? "assistant" : "admin";
  return companyId ? "assistant" : "admin";
}

function normalizeDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return new Date(value);
}

function normalizeRecord<T extends AnyRecord>(data: AnyRecord, id?: number): T {
  const output: AnyRecord = { ...data };
  if (id !== undefined) output.id = id;
  for (const key of ["createdAt", "updatedAt", "lastSignedIn", "dueDate", "paidDate"]) {
    if (output[key]) output[key] = normalizeDate(output[key]);
  }
  if (output.role !== undefined) {
    output.role = normalizeStoredRole(output.role, output.companyId ?? null);
  }
  return output as T;
}

async function nextId(collectionName: CollectionName): Promise<number> {
  const db = await getDb();
  const ref = db.collection("counters").doc(collectionName);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.value || 0) : 0;
    const value = current + 1;
    tx.set(ref, { value, updatedAt: now() }, { merge: true });
    return value;
  });
}

async function setWithNumericId<T extends AnyRecord>(collectionName: CollectionName, data: T) {
  const db = await getDb();
  const id = typeof data.id === "number" ? data.id : await nextId(collectionName);
  const payload = {
    ...data,
    id,
    createdAt: data.createdAt || now(),
    updatedAt: now(),
  };
  await db.collection(collectionName).doc(String(id)).set(payload, { merge: true });
  return normalizeRecord<T>(payload, id);
}

async function getByNumericId<T extends AnyRecord>(collectionName: CollectionName, id: number) {
  const db = await getDb();
  const snap = await db.collection(collectionName).doc(String(id)).get();
  if (!snap.exists) return undefined;
  return normalizeRecord<T>(snap.data() || {}, id);
}

async function updateByNumericId<T extends AnyRecord>(collectionName: CollectionName, id: number, data: Partial<T>) {
  const db = await getDb();
  const payload = { ...data, updatedAt: now() };
  await db.collection(collectionName).doc(String(id)).set(payload, { merge: true });
  return getByNumericId<T>(collectionName, id);
}

async function deleteByNumericId(collectionName: CollectionName, id: number) {
  const db = await getDb();
  await db.collection(collectionName).doc(String(id)).delete();
  return { success: true };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  const incomingEmail = normalizeEmail(user.email);
  const existingByOpenId = await db.collection("users").where("openId", "==", user.openId).limit(1).get();
  const ownerEmail = normalizeEmail(ENV.ownerEmail);
  const requestedRole = user.role || (incomingEmail && ownerEmail && incomingEmail === ownerEmail ? "admin" : "admin");

  if (!existingByOpenId.empty) {
    const doc = existingByOpenId.docs[0];
    const current = doc.data() as Partial<User>;
    await doc.ref.set(
      {
        name: user.name ?? current.name ?? null,
        email: incomingEmail ?? normalizeEmail(current.email) ?? null,
        loginMethod: user.loginMethod ?? current.loginMethod ?? null,
        role: normalizeStoredRole(current.role, current.companyId ?? null) || requestedRole,
        lastSignedIn: user.lastSignedIn || now(),
        updatedAt: now(),
      },
      { merge: true },
    );
    return;
  }

  if (incomingEmail) {
    const existingByEmail = await db.collection("users").where("email", "==", incomingEmail).limit(1).get();
    if (!existingByEmail.empty) {
      const doc = existingByEmail.docs[0];
      const stored = doc.data() as Partial<User>;
      if (typeof stored.openId === "string" && stored.openId.startsWith("pending:")) {
        await doc.ref.set(
          {
            openId: user.openId,
            name: user.name ?? stored.name ?? null,
            email: incomingEmail,
            loginMethod: user.loginMethod ?? stored.loginMethod ?? null,
            role: normalizeStoredRole(stored.role, stored.companyId ?? null),
            lastSignedIn: user.lastSignedIn || now(),
            updatedAt: now(),
          },
          { merge: true },
        );
        return;
      }
    }
  }

  const id = await nextId("users");
  await db.collection("users").doc(String(id)).set({
    id,
    openId: user.openId,
    name: user.name ?? null,
    email: incomingEmail,
    loginMethod: user.loginMethod ?? null,
    role: requestedRole,
    companyId: user.companyId ?? null,
    createdAt: now(),
    updatedAt: now(),
    lastSignedIn: user.lastSignedIn || now(),
  });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  const result = await db.collection("users").where("openId", "==", openId).limit(1).get();
  if (result.empty) return undefined;
  return normalizeRecord<User>(result.docs[0].data());
}

export async function getUserById(id: number) {
  return getByNumericId<User>("users", id);
}

export async function updateUserCompany(userId: number, companyId: number) {
  return updateByNumericId<User>("users", userId, { companyId } as Partial<User>);
}

export async function listUsersByCompanyId(companyId: number) {
  const db = await getDb();
  const result = await db.collection("users").where("companyId", "==", companyId).get();
  return result.docs
    .map(doc => normalizeRecord<User>(doc.data()))
    .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || "", "pt-BR"));
}

export async function createCompanyUser(input: { companyId: number; name: string; email: string; password: string; role: UserRole }) {
  const db = await getDb();
  const auth = await getAdminAuth();
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email) throw new Error("Informe um e-mail válido para o usuário.");

  const existing = await db.collection("users").where("email", "==", email).limit(1).get();
  let pendingUserId: number | null = null;

  if (!existing.empty) {
    const data = normalizeRecord<User>(existing.docs[0].data());
    const isLegacyPending = typeof data.openId === "string" && data.openId.startsWith("pending:");

    if (data.companyId !== input.companyId) {
      throw new Error("Este e-mail já está vinculado a outra empresa.");
    }

    if (!isLegacyPending) {
      throw new Error("Já existe um usuário com este e-mail nesta empresa.");
    }

    pendingUserId = data.id;
  }

  try {
    await auth.getUserByEmail(email);
    throw new Error("Este e-mail já possui uma conta de acesso. Use outro e-mail.");
  } catch (error: any) {
    if (error?.message === "Este e-mail já possui uma conta de acesso. Use outro e-mail.") {
      throw error;
    }
    if (error?.code !== "auth/user-not-found") {
      throw new Error("Não foi possível validar este e-mail no Firebase Auth.");
    }
  }

  let authUser: { uid: string } | null = null;
  try {
    authUser = await auth.createUser({
      email,
      password: input.password,
      displayName: name,
      disabled: false,
    });

    if (pendingUserId) {
      const updated = await updateByNumericId<User>("users", pendingUserId, {
        openId: authUser.uid,
        name,
        email,
        loginMethod: "password",
        role: input.role,
        companyId: input.companyId,
      } as Partial<User>);
      if (!updated) throw new Error("Não foi possível atualizar o usuário existente.");
      return updated;
    }

    return await setWithNumericId<User>("users", {
      openId: authUser.uid,
      name,
      email,
      loginMethod: "password",
      role: input.role,
      companyId: input.companyId,
      lastSignedIn: now(),
    } as User);
  } catch (error) {
    if (authUser?.uid) {
      try {
        await auth.deleteUser(authUser.uid);
      } catch (rollbackError) {
        console.error("[Users] Falha ao desfazer criação no Firebase Auth", rollbackError);
      }
    }
    throw error;
  }
}

export async function updateCompanyUser(id: number, data: { name?: string; role?: UserRole }) {
  return updateByNumericId<User>("users", id, {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.role ? { role: data.role } : {}),
  } as Partial<User>);
}

export async function deleteCompanyUser(id: number) {
  const user = await getUserById(id);
  if (user?.openId && !user.openId.startsWith("pending:")) {
    try {
      const auth = await getAdminAuth();
      await auth.deleteUser(user.openId);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        throw new Error("Não foi possível remover a conta de acesso do usuário.");
      }
    }
  }

  return deleteByNumericId("users", id);
}

export async function createCompany(company: InsertCompany) {
  const created = await setWithNumericId<Company>("companies", {
    ...company,
    logoUrl: company.logoUrl ?? null,
  } as Company);
  await updateByNumericId<User>("users", company.ownerId, {
    companyId: created.id,
    role: "admin",
  } as Partial<User>);
  return created;
}

export async function getCompanyById(id: number) {
  return getByNumericId<Company>("companies", id);
}

export async function getCompanyByOwnerId(ownerId: number) {
  const db = await getDb();
  const result = await db.collection("companies").where("ownerId", "==", ownerId).limit(1).get();
  if (result.empty) return undefined;
  return normalizeRecord<Company>(result.docs[0].data());
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  return updateByNumericId<Company>("companies", id, data as Partial<Company>);
}

export async function createClient(client: InsertClient) {
  return setWithNumericId<Client>("clients", {
    ...client,
    email: normalizeEmail(client.email),
    phone: client.phone ?? null,
    address: client.address ?? null,
    taxRegime: client.taxRegime ?? null,
    notes: client.notes ?? null,
    status: client.status || "active",
  } as Client);
}


function normalizeDocumentDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function normalizePhoneDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function normalizeImportedMoney(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return "0.00";
  let normalized = raw.replace(/\s/g, "").replace(/^R\$\s?/i, "");
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (hasComma) normalized = normalized.replace(",", ".");
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw new Error(`Valor de honorário inválido: ${raw}`);
  return numberValue.toFixed(2);
}

export type ClientImportRow = {
  name: string;
  cpfCnpj: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  monthlyFee?: string | null;
  notes?: string | null;
  taxRegime?: Client["taxRegime"];
};

export async function importClientsBatch(companyId: number, rows: ClientImportRow[]) {
  const existingClients = await getClientsByCompanyId(companyId);
  const existingDocuments = new Set(existingClients.map(client => normalizeDocumentDigits(client.cpfCnpj)).filter(Boolean));
  const existingPhones = new Set(existingClients.map(client => normalizePhoneDigits(client.phone)).filter(Boolean));
  const batchDocuments = new Set<string>();
  const batchPhones = new Set<string>();
  let imported = 0;
  let duplicates = 0;
  const errors: Array<{ row: number; name?: string; reason: string }> = [];
  for (const [index, row] of rows.entries()) {
    try {
      const name = row.name?.trim();
      const cpfCnpj = row.cpfCnpj?.trim();
      const documentDigits = normalizeDocumentDigits(cpfCnpj);
      const phoneDigits = normalizePhoneDigits(row.phone);
      if (!name) throw new Error("Nome não informado.");
      if (!cpfCnpj || documentDigits.length < 11) throw new Error("CPF/CNPJ inválido.");
      const duplicateByDocument = existingDocuments.has(documentDigits) || batchDocuments.has(documentDigits);
      const duplicateByPhone = Boolean(phoneDigits) && (existingPhones.has(phoneDigits) || batchPhones.has(phoneDigits));
      if (duplicateByDocument || duplicateByPhone) { duplicates += 1; continue; }
      await createClient({
        companyId,
        name,
        cpfCnpj,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        address: row.address?.trim() || null,
        monthlyFee: normalizeImportedMoney(row.monthlyFee),
        taxRegime: row.taxRegime ?? "simples_nacional",
        notes: row.notes?.trim() || null,
      });
      existingDocuments.add(documentDigits); batchDocuments.add(documentDigits);
      if (phoneDigits) { existingPhones.add(phoneDigits); batchPhones.add(phoneDigits); }
      imported += 1;
    } catch (error) {
      errors.push({ row: index + 1, name: row.name, reason: error instanceof Error ? error.message : "Falha ao importar a linha." });
    }
  }
  return { totalReceived: rows.length, imported, duplicates, errors, errorCount: errors.length };
}

export async function getClientsByCompanyId(companyId: number) {
  const db = await getDb();
  const result = await db.collection("clients").where("companyId", "==", companyId).get();
  return result.docs.map(doc => normalizeRecord<Client>(doc.data())).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getClientById(id: number) {
  return getByNumericId<Client>("clients", id);
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const payload = {
    ...data,
    ...(data.email !== undefined ? { email: normalizeEmail(data.email) } : {}),
  };
  return updateByNumericId<Client>("clients", id, payload as Partial<Client>);
}

export async function deleteClient(id: number) {
  return deleteByNumericId("clients", id);
}

function getFeeStatus(fee: Partial<Fee>) {
  if (fee.status === "paid") return "paid";
  const dueDate = normalizeDate(fee.dueDate);
  if (dueDate && dueDate < new Date(new Date().toDateString())) return "overdue";
  return fee.status || "pending";
}

export async function createFee(fee: InsertFee) {
  const id = await nextId("fees");
  const receiptNumber = `${new Date().getFullYear()}-${String(id).padStart(5, "0")}`;
  return setWithNumericId<Fee>("fees", {
    ...fee,
    id,
    status: fee.status || getFeeStatus(fee as Partial<Fee>),
    paidDate: fee.paidDate ?? null,
    receiptNumber,
    paymentMethod: fee.paymentMethod ?? null,
    paidByUserId: fee.paidByUserId ?? null,
  } as Fee);
}

export async function getFeesByCompanyId(companyId: number) {
  const db = await getDb();
  const result = await db.collection("fees").where("companyId", "==", companyId).get();
  const rows = result.docs.map(doc => normalizeRecord<Fee>(doc.data()));
  return rows.map(row => ({ ...row, status: getFeeStatus(row) as Fee["status"] })).sort((a, b) => Number(b.id) - Number(a.id));
}

export async function getFeesByClientId(clientId: number) {
  const db = await getDb();
  const result = await db.collection("fees").where("clientId", "==", clientId).get();
  return result.docs.map(doc => normalizeRecord<Fee>(doc.data())).map(row => ({ ...row, status: getFeeStatus(row) as Fee["status"] }));
}

export async function getFeeById(id: number) {
  const fee = await getByNumericId<Fee>("fees", id);
  return fee ? { ...fee, status: getFeeStatus(fee) as Fee["status"] } : undefined;
}

export async function updateFee(id: number, data: Partial<InsertFee>) {
  const payload: Partial<Fee> = { ...(data as Partial<Fee>) };
  if (payload.status === "paid" && !payload.paidDate) payload.paidDate = now();
  if (payload.status && payload.status !== "paid") {
    payload.paidDate = null;
    payload.paymentMethod = null;
    payload.paidByUserId = null;
  }
  return updateByNumericId<Fee>("fees", id, payload);
}

export async function deleteFee(id: number) {
  return deleteByNumericId("fees", id);
}


export async function createService(service: InsertService) {
  const isPaid = service.paymentStatus === "paid";
  return setWithNumericId<Service>("services", {
    ...service,
    paymentStatus: service.paymentStatus || "pending",
    paymentMethod: isPaid ? service.paymentMethod ?? null : null,
    paymentDate: isPaid ? service.paymentDate ?? now() : null,
    notes: service.notes ?? null,
    paidByUserId: isPaid ? service.paidByUserId ?? null : null,
  } as Service);
}

export async function getServicesByCompanyId(companyId: number) {
  const db = await getDb();
  const result = await db.collection("services").where("companyId", "==", companyId).get();
  const rows = result.docs
    .map(doc => normalizeRecord<Service>(doc.data()))
    .sort((a, b) => Number(b.id) - Number(a.id));

  return Promise.all(rows.map(async service => {
    const [createdBy, paidBy] = await Promise.all([
      service.createdByUserId ? getUserById(service.createdByUserId).catch(() => undefined) : undefined,
      service.paidByUserId ? getUserById(service.paidByUserId).catch(() => undefined) : undefined,
    ]);
    return {
      ...service,
      createdByName: createdBy?.name || createdBy?.email || "Não informado",
      paidByName: paidBy?.name || paidBy?.email || null,
    };
  }));
}

export async function getServiceById(id: number) {
  return getByNumericId<Service>("services", id);
}

export async function updateService(id: number, data: Partial<InsertService>) {
  const current = await getServiceById(id);
  if (!current) return undefined;

  const nextStatus = data.paymentStatus ?? current.paymentStatus;
  const payload: Partial<Service> = {
    ...(data as Partial<Service>),
  };

  if (nextStatus === "paid") {
    payload.paymentStatus = "paid";
    payload.paymentDate = data.paymentDate ?? current.paymentDate ?? now();
    payload.paymentMethod = data.paymentMethod ?? current.paymentMethod ?? null;
    payload.paidByUserId = data.paidByUserId ?? current.paidByUserId ?? null;
  } else {
    payload.paymentStatus = "pending";
    payload.paymentMethod = null;
    payload.paymentDate = null;
    payload.paidByUserId = null;
  }

  return updateByNumericId<Service>("services", id, payload);
}

export async function deleteService(id: number) {
  return deleteByNumericId("services", id);
}

export async function getDashboardStats(companyId: number, month?: string) {
  const [feesRows, clientsRows, servicesRows] = await Promise.all([
    getFeesByCompanyId(companyId),
    getClientsByCompanyId(companyId),
    getServicesByCompanyId(companyId),
  ]);

  const currentMonth = month || new Date().toISOString().slice(0, 7);
  const totalReceived = feesRows
    .filter(fee => fee.competence === currentMonth && fee.status === "paid")
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const pending = feesRows.filter(fee => fee.status === "pending");
  const overdue = feesRows.filter(fee => fee.status === "overdue");

  const servicesReceived = servicesRows
    .filter(service => service.paymentStatus === "paid" && normalizeDate(service.paymentDate)?.toISOString().slice(0, 7) === currentMonth)
    .reduce((sum, service) => sum + Number(service.amount || 0), 0);
  const servicesPendingRows = servicesRows.filter(service => service.paymentStatus === "pending");

  return {
    totalReceived,
    activeClients: clientsRows.filter(client => client.status === "active").length,
    pendingAmount: pending.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
    pendingCount: pending.length,
    overdueAmount: overdue.reduce((sum, fee) => sum + Number(fee.amount || 0), 0),
    overdueCount: overdue.length,
    servicesReceived,
    servicesPendingAmount: servicesPendingRows.reduce((sum, service) => sum + Number(service.amount || 0), 0),
    servicesCompletedCount: servicesRows.filter(service => service.paymentStatus === "paid").length,
    servicesPendingCount: servicesPendingRows.length,
  };
}

export async function createNotification(notification: InsertNotification) {
  return setWithNumericId<Notification>("notifications", {
    ...notification,
    isRead: notification.isRead || "false",
    relatedFeeId: notification.relatedFeeId ?? null,
  } as Notification);
}

export async function getNotificationsByUserId(userId: number) {
  const db = await getDb();
  const result = await db.collection("notifications").where("userId", "==", userId).get();
  return result.docs
    .map(doc => normalizeRecord<Notification>(doc.data()))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export async function markNotificationAsRead(id: number) {
  return updateByNumericId<Notification>("notifications", id, { isRead: "true" } as Partial<Notification>);
}

export async function deleteNotification(id: number) {
  return deleteByNumericId("notifications", id);
}

export async function deleteNotificationsByUserId(userId: number) {
  const db = await getDb();
  const result = await db.collection("notifications").where("userId", "==", userId).get();
  if (result.empty) return { success: true, removed: 0 };

  let removed = 0;
  const docs = result.docs;
  for (let index = 0; index < docs.length; index += 450) {
    const batch = db.batch();
    const chunk = docs.slice(index, index + 450);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    removed += chunk.length;
  }

  return { success: true, removed };
}

export async function generateDueNotifications(companyId: number, userId: number) {
  const feesRows = await getFeesByCompanyId(companyId);
  const today = new Date();
  const existing = await getNotificationsByUserId(userId);
  const existingKeys = new Set(existing.map(n => `${n.type}-${n.relatedFeeId}`));

  for (const fee of feesRows) {
    if (fee.status === "paid") continue;
    const dueDate = normalizeDate(fee.dueDate);
    if (!dueDate) continue;
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    const client = await getClientById(fee.clientId);

    if (diffDays >= 0 && diffDays <= 5 && !existingKeys.has(`fee_due_soon-${fee.id}`)) {
      await createNotification({
        userId,
        companyId,
        type: "fee_due_soon",
        title: "Honorário próximo do vencimento",
        message: `${client?.name || "Cliente"} vence em ${diffDays} dia(s).`,
        relatedFeeId: fee.id,
      } as InsertNotification);
    }

    if (diffDays < 0 && !existingKeys.has(`fee_overdue-${fee.id}`)) {
      await createNotification({
        userId,
        companyId,
        type: "fee_overdue",
        title: "Honorário em atraso",
        message: `${client?.name || "Cliente"} está com honorário vencido há ${Math.abs(diffDays)} dia(s).`,
        relatedFeeId: fee.id,
      } as InsertNotification);
    }
  }
}

export async function generateFeeReceipt(feeId: number, userId?: number) {
  const fee = await getFeeById(feeId);
  if (!fee) throw new Error("Honorário não encontrado.");

  if (userId) {
    const user = await getUserById(userId);
    if (!user) throw new Error("Conta não encontrada.");
    if (user.companyId !== fee.companyId) throw new Error("Acesso negado: honorário de outra empresa.");
  }

  const client = await getClientById(fee.clientId);
  if (!client) throw new Error("Cliente não encontrado.");

  const company = await getCompanyById(fee.companyId);
  if (!company) throw new Error("Empresa não encontrada.");

  const amountInWords = getAmountInWords(Number(fee.amount));
  return generateReceipt({
    companyName: company.legalName,
    companyCnpj: company.cnpj,
    companyAddress: company.address || undefined,
    companyPhone: company.phone || undefined,
    companyLogoUrl: company.logoUrl || undefined,
    clientName: client.name,
    clientCpfCnpj: client.cpfCnpj,
    clientAddress: client.address || undefined,
    competence: fee.competence,
    amount: Number(fee.amount),
    amountWords: amountInWords,
    dueDate: normalizeDate(fee.dueDate) || new Date(),
    receiptNumber: fee.receiptNumber || undefined,
    paidDate: normalizeDate(fee.paidDate) || undefined,
    paymentMethod: fee.paymentMethod || undefined,
  });
}


export async function getAppointmentsByUserRange(userId: number, companyId: number, from: string, to: string) {
  const db = await getDb();
  const result = await db.collection("appointments").where("userId", "==", userId).get();
  return result.docs
    .map(doc => normalizeRecord<Appointment>(doc.data()))
    .filter(item => item.companyId === companyId && item.date >= from && item.date <= to)
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
}

export async function getAppointmentById(id: number) {
  return getByNumericId<Appointment>("appointments", id);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function ensureAppointmentSlotIsFree(input: { userId: number; companyId: number; date: string; startTime: string; endTime: string; ignoreId?: number }) {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const startsOnGrid = startMinutes >= 8 * 60 && startMinutes <= 17 * 60 && startMinutes % 30 === 0;
  const endsCorrectly = endMinutes === startMinutes + 30 && endMinutes <= 17 * 60 + 30;
  if (!startsOnGrid || !endsCorrectly) {
    throw new Error("Escolha um horário disponível na agenda.");
  }

  const appointments = await getAppointmentsByUserRange(input.userId, input.companyId, input.date, input.date);
  const conflict = appointments.find(item =>
    item.id !== input.ignoreId &&
    item.status === "scheduled" &&
    item.startTime < input.endTime &&
    item.endTime > input.startTime,
  );
  if (conflict) throw new Error("Este horário já possui um agendamento ativo.");
}

export async function createAppointment(input: InsertAppointment) {
  await ensureAppointmentSlotIsFree(input);
  const appointment = await setWithNumericId<Appointment>("appointments", {
    ...input,
    clientName: input.clientName ?? null,
    clientPhone: input.clientPhone ?? null,
    notes: input.notes ?? null,
    status: input.status || "scheduled",
  } as Appointment);

  await createNotification({
    userId: appointment.userId,
    companyId: appointment.companyId,
    type: "appointment_created",
    title: "Novo agendamento criado",
    message: `${appointment.title} em ${appointment.date} às ${appointment.startTime}.`,
    relatedFeeId: null,
  } as InsertNotification);

  return appointment;
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Agendamento não encontrado.");
  const next = {
    ...current,
    ...data,
    clientName: data.clientName !== undefined ? data.clientName : current.clientName,
    clientPhone: data.clientPhone !== undefined ? data.clientPhone : current.clientPhone,
    notes: data.notes !== undefined ? data.notes : current.notes,
  };
  await ensureAppointmentSlotIsFree({
    userId: next.userId,
    companyId: next.companyId,
    date: next.date,
    startTime: next.startTime,
    endTime: next.endTime,
    ignoreId: id,
  });
  const appointment = await updateByNumericId<Appointment>("appointments", id, data as Partial<Appointment>);
  if (!appointment) throw new Error("Falha ao atualizar agendamento.");

  await createNotification({
    userId: appointment.userId,
    companyId: appointment.companyId,
    type: "appointment_updated",
    title: "Agendamento remarcado",
    message: `${appointment.title} em ${appointment.date} às ${appointment.startTime}.`,
    relatedFeeId: null,
  } as InsertNotification);

  return appointment;
}

export async function cancelAppointment(id: number) {
  const current = await getAppointmentById(id);
  if (!current) throw new Error("Agendamento não encontrado.");
  const appointment = await updateByNumericId<Appointment>("appointments", id, { status: "cancelled" } as Partial<Appointment>);
  if (!appointment) throw new Error("Falha ao cancelar agendamento.");

  await createNotification({
    userId: appointment.userId,
    companyId: appointment.companyId,
    type: "appointment_cancelled",
    title: "Agendamento cancelado",
    message: `${appointment.title} de ${appointment.date} às ${appointment.startTime} foi cancelado.`,
    relatedFeeId: null,
  } as InsertNotification);

  return appointment;
}
