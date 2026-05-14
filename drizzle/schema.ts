/**
 * Tipos compartilhados da aplicação.
 *
 * A persistência foi migrada de MySQL/Drizzle para Firebase Firestore.
 * Este arquivo permanece apenas como contrato TypeScript entre backend e frontend.
 */
export type UserRole = "assistant" | "admin";
export type ClientStatus = "active" | "inactive";
export type TaxRegime = "mei" | "simples_nacional" | "lucro_presumido" | "lucro_real";
export type FeeStatus = "pending" | "paid" | "overdue";
export type PaymentMethod = "pix" | "dinheiro" | "boleto" | "cartao_credito" | "cartao_debito" | "transferencia" | "outros";
export type ServiceType = "itr" | "ccir" | "contratos" | "cartao_produtor" | "irpf" | "emissao_nf" | "prestacao_mei" | "prestacao_avulsos";
export type ServicePaymentStatus = "pending" | "paid";
export type NotificationType = "fee_due_soon" | "fee_overdue" | "appointment_created" | "appointment_updated" | "appointment_cancelled" | "system";
export type AppointmentStatus = "scheduled" | "cancelled";
export type ReadFlag = "true" | "false";

export interface User {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  companyId: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

export type InsertUser = Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & {
  openId: string;
};

export interface Company {
  id: number;
  ownerId: number;
  legalName: string;
  cnpj: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertCompany = Omit<Company, "id" | "createdAt" | "updatedAt" | "address" | "phone" | "logoUrl"> & { address?: string | null; phone?: string | null; logoUrl?: string | null };

export interface Client {
  id: number;
  companyId: number;
  name: string;
  cpfCnpj: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  monthlyFee: string;
  taxRegime: TaxRegime | null;
  status: ClientStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertClient = Omit<Client, "id" | "createdAt" | "updatedAt" | "email" | "phone" | "address" | "taxRegime" | "status"> & { email?: string | null; phone?: string | null; address?: string | null; taxRegime?: TaxRegime | null; status?: ClientStatus };

export interface Fee {
  id: number;
  clientId: number;
  companyId: number;
  competence: string;
  amount: string;
  status: FeeStatus;
  dueDate: Date;
  paidDate: Date | null;
  receiptNumber: string | null;
  paymentMethod: PaymentMethod | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertFee = Omit<Fee, "id" | "createdAt" | "updatedAt" | "receiptNumber" | "status" | "paidDate" | "paymentMethod"> & {
  status?: FeeStatus;
  paidDate?: Date | null;
  receiptNumber?: string | null;
  paymentMethod?: PaymentMethod | null;
};



export interface Service {
  id: number;
  companyId: number;
  clientName: string;
  serviceType: ServiceType;
  amount: string;
  paymentStatus: ServicePaymentStatus;
  paymentMethod: PaymentMethod | null;
  serviceDate: Date;
  paymentDate: Date | null;
  notes: string | null;
  createdByUserId: number;
  paidByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertService = Omit<Service, "id" | "createdAt" | "updatedAt" | "paymentMethod" | "paymentDate" | "notes" | "paidByUserId" | "paymentStatus"> & {
  paymentStatus?: ServicePaymentStatus;
  paymentMethod?: PaymentMethod | null;
  paymentDate?: Date | null;
  notes?: string | null;
  paidByUserId?: number | null;
};

export interface Appointment {
  id: number;
  userId: number;
  companyId: number;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  notes: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertAppointment = Omit<Appointment, "id" | "createdAt" | "updatedAt" | "status" | "clientName" | "clientPhone" | "notes"> & {
  status?: AppointmentStatus;
  clientName?: string | null;
  clientPhone?: string | null;
  notes?: string | null;
};

export interface Notification {
  id: number;
  userId: number;
  companyId: number;
  type: NotificationType;
  title: string;
  message: string;
  relatedFeeId: number | null;
  isRead: ReadFlag;
  createdAt: Date;
  updatedAt?: Date;
}

export type InsertNotification = Omit<Notification, "id" | "createdAt" | "updatedAt"> & {
  isRead?: ReadFlag;
  relatedFeeId?: number | null;
};
