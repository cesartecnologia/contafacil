import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, Download, CheckCircle2, MoreVertical, MessageCircle, Eye, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/ConfirmDialogProvider";
import { Badge } from "@/components/ui/badge";

const feeSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  competence: z.string().min(1, "Competência é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  dueDate: z.string().min(1, "Data de vencimento é obrigatória"),
});

type FeeFormData = z.infer<typeof feeSchema>;

function normalizeWhatsappPhone(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function getPaymentMethodLabel(paymentMethod?: string | null) {
  switch (paymentMethod) {
    case "pix": return "PIX";
    case "dinheiro": return "Dinheiro";
    case "boleto": return "Boleto";
    case "cartao_credito": return "Cartão de crédito";
    case "cartao_debito": return "Cartão de débito";
    case "transferencia": return "Transferência";
    case "outros": return "Outros";
    default: return "Não informado";
  }
}

export default function Fees() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailsFee, setDetailsFee] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [feeToPay, setFeeToPay] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const { confirm } = useConfirmDialog();

  const { data: fees = [], isLoading: feesLoading, refetch: refetchFees } = trpc.fees.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );

  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );

  const createMutation = trpc.fees.create.useMutation({
    onSuccess: () => {
      toast.success("Honorário registrado com sucesso!");
      refetchFees();
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => toast.error("Erro ao registrar honorário: " + error.message),
  });

  const updateMutation = trpc.fees.update.useMutation({
    onSuccess: () => {
      toast.success("Honorário atualizado com sucesso!");
      refetchFees();
      setIsOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error) => toast.error("Erro ao atualizar honorário: " + error.message),
  });

  const markPaidMutation = trpc.fees.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso!");
      refetchFees();
      setPaymentDialogOpen(false);
      setFeeToPay(null);
      setPaymentMethod("");
      setDetailsFee(null);
    },
    onError: error => toast.error(`Erro ao registrar pagamento: ${error.message}`),
  });

  const deleteMutation = trpc.fees.delete.useMutation({
    onSuccess: () => {
      toast.success("Honorário excluído com sucesso!");
      refetchFees();
    },
    onError: (error) => toast.error("Erro ao excluir honorário: " + error.message),
  });

  const form = useForm<FeeFormData>({
    resolver: zodResolver(feeSchema),
    defaultValues: { clientId: "", competence: "", amount: "", dueDate: "" },
  });

  const selectedClientId = form.watch("clientId");

  useEffect(() => {
    if (editingId || !selectedClientId) return;
    const selectedClient = clients.find(client => String(client.id) === selectedClientId);
    if (!selectedClient) return;
    form.setValue("amount", String(selectedClient.monthlyFee || ""), { shouldValidate: true });
  }, [clients, editingId, form, selectedClientId]);

  const onSubmit = (data: FeeFormData) => {
    if (!companyId) return;
    const clientId = Number.parseInt(data.clientId, 10);
    const dueDate = new Date(data.dueDate);

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        clientId,
        competence: data.competence,
        amount: data.amount,
        dueDate,
      });
      return;
    }

    createMutation.mutate({
      clientId,
      companyId,
      competence: data.competence,
      amount: data.amount,
      dueDate,
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Excluir honorário",
      description: "Tem certeza que deseja excluir este honorário? Esta ação não poderá ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (confirmed) deleteMutation.mutate(id);
  };

  const handleEdit = (fee: any) => {
    setEditingId(fee.id);
    form.reset({
      clientId: String(fee.clientId),
      competence: fee.competence,
      amount: String(fee.amount),
      dueDate: new Date(fee.dueDate).toISOString().slice(0, 10),
    });
    setIsOpen(true);
  };

  const handleMarkAsPaid = (fee: any) => {
    setFeeToPay(fee);
    setPaymentMethod("");
    setPaymentDialogOpen(true);
  };

  const confirmPayment = () => {
    if (!feeToPay) return;
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    markPaidMutation.mutate({
      id: feeToPay.id,
      paymentMethod: paymentMethod as "pix" | "dinheiro" | "boleto" | "cartao_credito" | "cartao_debito" | "transferencia" | "outros",
    });
  };

  const receiptMutation = trpc.receipts.generate.useMutation();

  const downloadReceipt = (feeId: number) => {
    receiptMutation.mutate(feeId, {
      onSuccess: (result) => {
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Recibo baixado com sucesso!");
      },
      onError: (error) => toast.error("Erro ao gerar recibo: " + error.message),
    });
  };

  const sendReceiptWhatsapp = (fee: any) => {
    const client = clients.find(item => item.id === fee.clientId);
    const phone = normalizeWhatsappPhone(client?.phone);
    if (!phone) {
      toast.error("Cadastre o telefone do cliente para usar o envio por WhatsApp.");
      return;
    }
    const message = [
      `Olá, ${client?.name || "cliente"}!`,
      "",
      "Segue o comprovante do honorário contábil:",
      `• Competência: ${fee.competence}`,
      `• Valor: ${formatCurrency(Number(fee.amount))}`,
      `• Vencimento: ${new Date(fee.dueDate).toLocaleDateString("pt-BR")}`,
      `• Forma de pagamento: ${getPaymentMethodLabel(fee.paymentMethod)}`,
      `• Situação: ${fee.status === "paid" ? "Pago" : fee.status === "overdue" ? "Vencido" : "Pendente"}`,
      "",
    ].join("\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500">Pago</Badge>;
      case "pending": return <Badge className="bg-yellow-500">Pendente</Badge>;
      case "overdue": return <Badge className="bg-red-500">Vencido</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getClientName = (clientId: number) => clients.find(client => client.id === clientId)?.name || "Cliente desconhecido";
  const isLoading = feesLoading || clientsLoading;
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const filteredFees = useMemo(() => {
    if (!normalizedSearch) return fees;

    return fees.filter(fee => {
      const clientName = clients.find(client => client.id === fee.clientId)?.name || "Cliente desconhecido";
      const statusLabel = fee.status === "paid" ? "pago" : fee.status === "overdue" ? "vencido" : "pendente";
      const dueDate = new Date(fee.dueDate).toLocaleDateString("pt-BR");
      const searchableContent = [
        clientName,
        fee.competence,
        fee.amount,
        formatCurrency(Number(fee.amount)),
        dueDate,
        getPaymentMethodLabel(fee.paymentMethod),
        statusLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return searchableContent.includes(normalizedSearch);
    });
  }, [clients, fees, normalizedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Honorários</h1>
          <p className="mt-1 text-muted-foreground">Registre, acompanhe e envie comprovantes dos honorários mensais.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setEditingId(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Honorário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Honorário" : "Novo Honorário"}</DialogTitle>
              <DialogDescription>{editingId ? "Atualize as informações do honorário." : "Registre um novo honorário mensal."}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clients.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="competence" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Competência</FormLabel>
                      <FormControl><Input type="month" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="dueDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de vencimento</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Salvar alterações" : "Registrar Honorário"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-white/20 bg-white/40 backdrop-blur-md">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Honorários Registrados</CardTitle>
            <CardDescription>Use o botão de três pontos para acessar as ações de cada lançamento.</CardDescription>
          </div>
          <div className="relative w-full sm:w-[290px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar honorários"
              className="h-10 rounded-full border-primary/55 bg-white/45 pl-9 pr-4 shadow-none backdrop-blur-md transition-colors hover:border-primary/75 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Buscar honorários"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : fees.length > 0 ? (
            filteredFees.length > 0 ? (
            <>
              <div className="space-y-3 md:hidden">
                {filteredFees.map(fee => (
                  <div
                    key={`mobile-${fee.id}`}
                    role="button"
                    tabIndex={0}
                    className="w-full rounded-2xl border border-white/30 bg-white/45 p-4 text-left shadow-sm backdrop-blur-md transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setDetailsFee(fee)}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setDetailsFee(fee); }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold">{getClientName(fee.clientId)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Competência {fee.competence}</p>
                      </div>
                      <div onClick={event => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Abrir ações do honorário"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsFee(fee)}><Eye className="mr-2 h-4 w-4" /> Ver detalhes</DropdownMenuItem>
                            {fee.status !== "paid" ? <DropdownMenuItem onClick={() => handleMarkAsPaid(fee)}><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Marcar como pago</DropdownMenuItem> : null}
                            <DropdownMenuItem onClick={() => handleEdit(fee)}><Edit2 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadReceipt(fee.id)}><Download className="mr-2 h-4 w-4" /> Baixar recibo PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendReceiptWhatsapp(fee)}><MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp</DropdownMenuItem>
                            {user?.role === "admin" ? <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(fee.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem> : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-semibold text-primary">{formatCurrency(Number(fee.amount))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vencimento</p>
                        <p className="font-medium">{new Date(fee.dueDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pagamento</p>
                        <p className="font-medium">{getPaymentMethodLabel(fee.paymentMethod)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="mt-1">{getStatusBadge(fee.status)}</div>
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
                    <th className="px-4 py-3 text-left font-semibold">Competência</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-left font-semibold">Pagamento</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.map(fee => (
                    <tr
                      key={fee.id}
                      className="cursor-pointer border-b transition-colors hover:bg-white/20"
                      onClick={() => setDetailsFee(fee)}
                    >
                      <td className="px-4 py-3">{getClientName(fee.clientId)}</td>
                      <td className="px-4 py-3">{fee.competence}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(fee.amount))}</td>
                      <td className="px-4 py-3">{new Date(fee.dueDate).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">{getPaymentMethodLabel(fee.paymentMethod)}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(fee.status)}</td>
                      <td className="px-4 py-3 text-right" onClick={event => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Abrir ações do honorário"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsFee(fee)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                            {fee.status !== "paid" ? (
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(fee)}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Marcar como pago
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => handleEdit(fee)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadReceipt(fee.id)}>
                              <Download className="mr-2 h-4 w-4" /> Baixar recibo PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendReceiptWhatsapp(fee)}>
                              <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                            </DropdownMenuItem>
                            {user?.role === "admin" ? (
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(fee.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
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
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">Nenhum honorário encontrado para a busca.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="mb-4 text-muted-foreground">Nenhum honorário registrado</p>
              <Button onClick={() => setIsOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Registrar Primeiro Honorário</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialogOpen} onOpenChange={open => {
        setPaymentDialogOpen(open);
        if (!open) { setFeeToPay(null); setPaymentMethod(""); }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>Selecione a forma de pagamento para concluir o recebimento deste honorário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {feeToPay ? (
              <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                <p className="font-semibold">{getClientName(feeToPay.clientId)}</p>
                <p className="mt-1 text-muted-foreground">Competência {feeToPay.competence} · {formatCurrency(Number(feeToPay.amount))}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm font-medium">Forma de pagamento</p>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={confirmPayment} disabled={markPaidMutation.isPending || !paymentMethod}>{markPaidMutation.isPending ? "Salvando..." : "Confirmar pagamento"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsFee} onOpenChange={open => !open && setDetailsFee(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Honorário</DialogTitle>
            <DialogDescription>Consulte as informações do lançamento e acesse as ações disponíveis.</DialogDescription>
          </DialogHeader>
          {detailsFee ? (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
                  <p className="text-lg font-bold">{getClientName(detailsFee.clientId)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Competência</p>
                  <p className="font-medium">{detailsFee.competence}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{new Date(detailsFee.dueDate).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Forma de pagamento</p>
                  <p className="font-medium">{getPaymentMethodLabel(detailsFee.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Situação</p>
                  <div className="mt-1">{getStatusBadge(detailsFee.status)}</div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(Number(detailsFee.amount))}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                {detailsFee.status !== "paid" ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      handleMarkAsPaid(detailsFee);
                      setDetailsFee(null);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Marcar como pago
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const fee = detailsFee;
                    setDetailsFee(null);
                    handleEdit(fee);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => downloadReceipt(detailsFee.id)}>
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => sendReceiptWhatsapp(detailsFee)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                {user?.role === "admin" ? (
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => {
                      const id = detailsFee.id;
                      setDetailsFee(null);
                      handleDelete(id);
                    }}
                  >
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
