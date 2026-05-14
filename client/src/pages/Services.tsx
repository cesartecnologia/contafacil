import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, MoreVertical, Eye, Search, CheckCircle2, RotateCcw, BriefcaseBusiness } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/ConfirmDialogProvider";
import { Badge } from "@/components/ui/badge";

const serviceTypeValues = ["itr", "ccir", "contratos", "cartao_produtor", "irpf", "emissao_nf", "prestacao_mei", "prestacao_avulsos"] as const;
const paymentMethodValues = ["dinheiro", "pix", "cartao_debito", "cartao_credito", "boleto", "transferencia", "outros"] as const;

const serviceSchema = z.object({
  clientName: z.string().trim().min(1, "Nome do cliente é obrigatório"),
  serviceType: z.enum(serviceTypeValues, { message: "Selecione o tipo de serviço" }),
  amount: z.string().trim().min(1, "Valor é obrigatório").regex(/^\d+(?:\.\d{1,2})?$/, "Informe um valor válido"),
  paymentStatus: z.enum(["pending", "paid"]),
  serviceDate: z.string().min(1, "Data do serviço é obrigatória"),
  notes: z.string().trim().max(1000, "As observações são muito longas").optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;
type PaymentMethodValue = typeof paymentMethodValues[number];

const serviceTypeLabels: Record<string, string> = {
  itr: "ITR",
  ccir: "CCIR",
  contratos: "Contratos",
  cartao_produtor: "Cartão de Produtor",
  irpf: "IRPF",
  emissao_nf: "Emissão de NF",
  prestacao_mei: "Prestação de Serviços MEI",
  prestacao_avulsos: "Prestação de Serviços Avulsos",
};

const paymentMethodLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Cartão de Débito",
  cartao_credito: "Cartão de Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outros: "Outros",
};

function getPaymentMethodLabel(value?: string | null) {
  return value ? paymentMethodLabels[value] || value : "Não informado";
}

function getPaymentStatusBadge(status: string) {
  return status === "paid"
    ? <Badge className="bg-green-500">Pago</Badge>
    : <Badge className="bg-yellow-500">Pendente</Badge>;
}

export default function Services() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const { confirm } = useConfirmDialog();
  const [isOpen, setIsOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [detailsService, setDetailsService] = useState<any | null>(null);
  const [serviceToPay, setServiceToPay] = useState<any | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<{ mode: "create" | "update"; payload: any } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: services = [], isLoading, refetch } = trpc.services.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      toast.success("Serviço registrado com sucesso!");
      refetch();
      closeForm();
      closePaymentDialog();
    },
    onError: error => toast.error(`Erro ao registrar serviço: ${error.message}`),
  });

  const updateMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      toast.success("Serviço atualizado com sucesso!");
      refetch();
      closeForm();
      closePaymentDialog();
      setDetailsService(null);
    },
    onError: error => toast.error(`Erro ao atualizar serviço: ${error.message}`),
  });

  const deleteMutation = trpc.services.delete.useMutation({
    onSuccess: () => {
      toast.success("Serviço excluído com sucesso!");
      refetch();
      setDetailsService(null);
    },
    onError: error => toast.error(`Erro ao excluir serviço: ${error.message}`),
  });

  const markPaidMutation = trpc.services.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento do serviço registrado!");
      refetch();
      closePaymentDialog();
      setDetailsService(null);
    },
    onError: error => toast.error(`Erro ao registrar pagamento: ${error.message}`),
  });

  const markPendingMutation = trpc.services.markPending.useMutation({
    onSuccess: () => {
      toast.success("Serviço retornou para pendente.");
      refetch();
      setDetailsService(null);
    },
    onError: error => toast.error(`Erro ao atualizar status: ${error.message}`),
  });

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      clientName: "",
      serviceType: "itr",
      amount: "",
      paymentStatus: "pending",
      serviceDate: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const closeForm = () => {
    setIsOpen(false);
    setEditingService(null);
    form.reset({
      clientName: "",
      serviceType: "itr",
      amount: "",
      paymentStatus: "pending",
      serviceDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  };

  const closePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setPaymentMethod("");
    setServiceToPay(null);
    setPendingSubmit(null);
  };

  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) closeForm();
  };

  const submitPayload = (data: ServiceFormData) => ({
    companyId,
    clientName: data.clientName.trim(),
    serviceType: data.serviceType,
    amount: data.amount,
    paymentStatus: data.paymentStatus,
    serviceDate: new Date(`${data.serviceDate}T12:00:00`),
    notes: data.notes?.trim() || null,
  });

  const onSubmit = (data: ServiceFormData) => {
    if (!companyId) {
      toast.error("Cadastre a empresa antes de registrar serviços.");
      return;
    }

    const payload = submitPayload(data);
    const movingToPaid = data.paymentStatus === "paid" && (!editingService || editingService.paymentStatus !== "paid");

    if (movingToPaid) {
      setPendingSubmit({
        mode: editingService ? "update" : "create",
        payload: editingService ? { id: editingService.id, ...payload } : payload,
      });
      setPaymentMethod("");
      setPaymentDialogOpen(true);
      return;
    }

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, ...payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    form.reset({
      clientName: service.clientName,
      serviceType: service.serviceType,
      amount: String(service.amount),
      paymentStatus: service.paymentStatus,
      serviceDate: new Date(service.serviceDate).toISOString().slice(0, 10),
      notes: service.notes || "",
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Excluir serviço",
      description: "Tem certeza que deseja excluir este serviço? Esta ação não poderá ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (confirmed) deleteMutation.mutate(id);
  };

  const openMarkPaid = (service: any) => {
    setServiceToPay(service);
    setPaymentMethod("");
    setPaymentDialogOpen(true);
  };

  const handleMarkPending = async (service: any) => {
    const confirmed = await confirm({
      title: "Retornar para pendente",
      description: "A forma de pagamento e a data do pagamento serão removidas deste serviço.",
      confirmText: "Confirmar",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (confirmed) markPendingMutation.mutate(service.id);
  };

  const confirmPayment = () => {
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }

    if (pendingSubmit) {
      const payload = {
        ...pendingSubmit.payload,
        paymentMethod,
        paymentDate: new Date(),
      };
      if (pendingSubmit.mode === "create") createMutation.mutate(payload);
      else updateMutation.mutate(payload);
      return;
    }

    if (serviceToPay) {
      markPaidMutation.mutate({ id: serviceToPay.id, paymentMethod });
    }
  };

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const filteredServices = useMemo(() => {
    if (!normalizedSearch) return services;

    return services.filter(service => {
      const content = [
        service.clientName,
        serviceTypeLabels[service.serviceType],
        service.amount,
        formatCurrency(Number(service.amount || 0)),
        service.paymentStatus === "paid" ? "pago" : "pendente",
        getPaymentMethodLabel(service.paymentMethod),
        new Date(service.serviceDate).toLocaleDateString("pt-BR"),
        service.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return content.includes(normalizedSearch);
    });
  }, [normalizedSearch, services]);

  const paymentSubject = pendingSubmit
    ? pendingSubmit.payload.clientName
    : serviceToPay?.clientName;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
          <p className="mt-1 text-muted-foreground">Registre serviços avulsos e acompanhe os pagamentos.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Serviço</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
            <DialogHeader>
              <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
              <DialogDescription>
                {editingService ? "Atualize as informações do serviço." : "Cadastre um serviço com status e dados financeiros."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do cliente</FormLabel>
                    <FormControl><Input placeholder="Informe o cliente" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="serviceType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de serviço</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {serviceTypeValues.map(type => (
                            <SelectItem key={type} value={type}>{serviceTypeLabels[type]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do serviço</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.01" placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status do pagamento</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="serviceDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do serviço</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Observações opcionais" className="min-h-[96px]" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingService ? "Salvar alterações" : "Registrar Serviço"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-white/20 bg-white/40 backdrop-blur-md">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Serviços Registrados</CardTitle>
            <CardDescription>Acompanhe pagamentos, detalhes e ações de cada serviço.</CardDescription>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar serviços"
              className="h-10 rounded-full border-primary/55 bg-white/45 pl-9 pr-4 shadow-none backdrop-blur-md transition-colors hover:border-primary/75 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BriefcaseBusiness className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="mb-4 text-muted-foreground">Nenhum serviço registrado</p>
              <Button onClick={() => setIsOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Registrar Primeiro Serviço</Button>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">Nenhum serviço encontrado para a busca.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredServices.map(service => (
                  <div
                    key={`service-mobile-${service.id}`}
                    role="button"
                    tabIndex={0}
                    className="w-full rounded-2xl border border-white/30 bg-white/45 p-4 text-left shadow-sm backdrop-blur-md transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setDetailsService(service)}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setDetailsService(service); }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{service.clientName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{serviceTypeLabels[service.serviceType]}</p>
                      </div>
                      <div onClick={event => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Abrir ações do serviço"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsService(service)}><Eye className="mr-2 h-4 w-4" /> Ver detalhes</DropdownMenuItem>
                            {service.paymentStatus !== "paid" ? (
                              <DropdownMenuItem onClick={() => openMarkPaid(service)}><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Marcar como pago</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void handleMarkPending(service)}><RotateCcw className="mr-2 h-4 w-4" /> Voltar para pendente</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(service)}><Edit2 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                            {user?.role === "admin" ? (
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleDelete(service.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-semibold text-primary">{formatCurrency(Number(service.amount))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Data</p>
                        <p className="font-medium">{new Date(service.serviceDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pagamento</p>
                        <p className="font-medium">{getPaymentMethodLabel(service.paymentMethod)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-1">{getPaymentStatusBadge(service.paymentStatus)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-left font-semibold">Serviço</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                      <th className="px-4 py-3 text-left font-semibold">Data</th>
                      <th className="px-4 py-3 text-left font-semibold">Pagamento</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map(service => (
                      <tr
                        key={service.id}
                        className="cursor-pointer border-b transition-colors hover:bg-white/20"
                        onClick={() => setDetailsService(service)}
                      >
                        <td className="px-4 py-3">{service.clientName}</td>
                        <td className="px-4 py-3">{serviceTypeLabels[service.serviceType]}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(service.amount))}</td>
                        <td className="px-4 py-3">{new Date(service.serviceDate).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">{getPaymentMethodLabel(service.paymentMethod)}</td>
                        <td className="px-4 py-3 text-center">{getPaymentStatusBadge(service.paymentStatus)}</td>
                        <td className="px-4 py-3 text-right" onClick={event => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Abrir ações do serviço"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailsService(service)}><Eye className="mr-2 h-4 w-4" /> Ver detalhes</DropdownMenuItem>
                              {service.paymentStatus !== "paid" ? (
                                <DropdownMenuItem onClick={() => openMarkPaid(service)}><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Marcar como pago</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => void handleMarkPending(service)}><RotateCcw className="mr-2 h-4 w-4" /> Voltar para pendente</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEdit(service)}><Edit2 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                              {user?.role === "admin" ? (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleDelete(service.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={open => { if (!open) closePaymentDialog(); else setPaymentDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Informar forma de pagamento</DialogTitle>
            <DialogDescription>
              Selecione como o pagamento do serviço de {paymentSubject || "cliente"} foi realizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as PaymentMethodValue)}>
              <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
              <SelectContent>
                {paymentMethodValues.map(method => <SelectItem key={method} value={method}>{paymentMethodLabels[method]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closePaymentDialog}>Cancelar</Button>
              <Button type="button" onClick={confirmPayment} disabled={!paymentMethod || createMutation.isPending || updateMutation.isPending || markPaidMutation.isPending}>
                Confirmar pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsService} onOpenChange={open => !open && setDetailsService(null)}>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Serviço</DialogTitle>
            <DialogDescription>Consulte as informações e gerencie o status do pagamento.</DialogDescription>
          </DialogHeader>
          {detailsService ? (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="text-lg font-bold">{detailsService.clientName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviço</p>
                  <p className="font-medium">{serviceTypeLabels[detailsService.serviceType]}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Data do serviço</p>
                  <p className="font-medium">{new Date(detailsService.serviceDate).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">{getPaymentStatusBadge(detailsService.paymentStatus)}</div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Forma de pagamento</p>
                  <p className="font-medium">{getPaymentMethodLabel(detailsService.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Data do pagamento</p>
                  <p className="font-medium">{detailsService.paymentDate ? new Date(detailsService.paymentDate).toLocaleDateString("pt-BR") : "Não informado"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(Number(detailsService.amount))}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                  <p className="whitespace-pre-wrap font-medium">{detailsService.notes || "Não informado"}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {detailsService.paymentStatus !== "paid" ? (
                  <Button variant="outline" className="gap-2" onClick={() => openMarkPaid(detailsService)}>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Marcar como pago
                  </Button>
                ) : (
                  <Button variant="outline" className="gap-2" onClick={() => void handleMarkPending(detailsService)}>
                    <RotateCcw className="h-4 w-4" />
                    Voltar para pendente
                  </Button>
                )}
                <Button variant="outline" className="gap-2" onClick={() => handleEdit(detailsService)}>
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
                {user?.role === "admin" ? (
                  <Button variant="destructive" className="gap-2" onClick={() => void handleDelete(detailsService.id)}>
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
