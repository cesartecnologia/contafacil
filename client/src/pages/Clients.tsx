import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Plus, Trash2, Edit2, Eye, Building2, Mail, Phone, MapPin, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/ConfirmDialogProvider";

const taxRegimeLabels = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
} as const;

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cpfCnpj: z.string().min(11, "CPF/CNPJ inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  monthlyFee: z.string().min(1, "Honorário mensal é obrigatório"),
  taxRegime: z.enum(["mei", "simples_nacional", "lucro_presumido", "lucro_real"]),
});

type ClientFormData = z.infer<typeof clientSchema>;

const CLIENTS_PER_PAGE = 8;

export default function Clients() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const [isOpen, setIsOpen] = useState(false);
  const [detailsClient, setDetailsClient] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { confirm } = useConfirmDialog();

  const { data: clients = [], isLoading, refetch } = trpc.clients.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
  const filteredClients = useMemo(() => {
    if (!normalizedSearch) return clients;
    return clients.filter(client => [
      client.name,
      client.cpfCnpj,
      client.email,
      client.phone,
      client.address,
      client.monthlyFee,
      taxRegimeLabels[(client.taxRegime || "simples_nacional") as keyof typeof taxRegimeLabels],
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch));
  }, [clients, normalizedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleClients = filteredClients.slice(
    (safeCurrentPage - 1) * CLIENTS_PER_PAGE,
    safeCurrentPage * CLIENTS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado com sucesso!");
      refetch();
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => toast.error("Erro ao criar cliente: " + error.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      refetch();
      setIsOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error) => toast.error("Erro ao atualizar cliente: " + error.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente excluído com sucesso!");
      refetch();
    },
    onError: (error) => toast.error("Erro ao excluir cliente: " + error.message),
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      cpfCnpj: "",
      email: "",
      phone: "",
      address: "",
      monthlyFee: "",
      taxRegime: "simples_nacional",
    },
  });

  const onSubmit = (data: ClientFormData) => {
    if (!companyId) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
      return;
    }
    createMutation.mutate({ companyId, ...data });
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    form.reset({
      name: client.name,
      cpfCnpj: client.cpfCnpj,
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      monthlyFee: client.monthlyFee,
      taxRegime: client.taxRegime || "simples_nacional",
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Excluir cliente",
      description: "Tem certeza que deseja excluir este cliente? Esta ação não poderá ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (confirmed) deleteMutation.mutate(id);
  };

  const closeClientDialog = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingId(null);
      form.reset({
        name: "",
        cpfCnpj: "",
        email: "",
        phone: "",
        address: "",
        monthlyFee: "",
        taxRegime: "simples_nacional",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="mt-1 text-muted-foreground">Gerencie seus clientes, regimes tributários e honorários mensais.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={closeClientDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Atualize os dados cadastrais e o regime tributário." : "Adicione um cliente à carteira do escritório."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome / Razão Social</FormLabel>
                    <FormControl><Input placeholder="Nome do cliente" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cpfCnpj" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl><Input placeholder="000.000.000-00 ou 00.000.000/0000-00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="taxRegime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime da empresa</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="mei">MEI</SelectItem>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" placeholder="email@empresa.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input placeholder="(33) 99999-9999" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input placeholder="Rua, número, cidade" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="monthlyFee" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Honorário Mensal (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full md:col-span-2" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Salvar alterações" : "Criar Cliente"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-start">
        <div className="relative w-full sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Buscar clientes"
            className="h-10 rounded-full border-primary/55 bg-white/45 pl-9 pr-4 shadow-none backdrop-blur-md transition-colors hover:border-primary/75 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Buscar clientes"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {isLoading ? (
          <>
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </>
        ) : clients.length > 0 ? (
          filteredClients.length > 0 ? visibleClients.map(client => (
            <Card
              key={client.id}
              className="cursor-pointer gap-0 overflow-hidden border-white/20 bg-white/40 py-0 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/55"
              onClick={() => setDetailsClient(client)}
            >
              <CardHeader className="flex w-full flex-row items-start justify-between gap-3 bg-gradient-to-br from-primary/[0.11] via-primary/[0.055] to-primary/[0.015] px-6 py-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="line-clamp-2 text-xl font-extrabold leading-tight text-foreground">{client.name}</CardTitle>
                  <div className="my-2 h-px w-full bg-gradient-to-r from-primary/80 via-primary/35 to-transparent" aria-hidden="true" />
                  <CardDescription className="text-xs font-medium tracking-[0.01em]">{client.cpfCnpj}</CardDescription>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                    <span className="truncate">{client.phone || "Telefone não informado"}</span>
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
                    <Button size="icon" variant="ghost" aria-label="Abrir ações do cliente">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setDetailsClient(client)}>
                      <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(client)}>
                      <Edit2 className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    {user?.role === "admin" ? (
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-3 px-6 py-5">
                <Badge variant="secondary">{taxRegimeLabels[(client.taxRegime || "simples_nacional") as keyof typeof taxRegimeLabels]}</Badge>
                <div className="text-sm">
                  <span className="text-muted-foreground">Honorário mensal</span>
                  <p className="text-lg font-bold text-primary">{formatCurrency(Number(client.monthlyFee))}</p>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card className="border-white/20 bg-white/40 backdrop-blur-md sm:col-span-2 lg:col-span-3 2xl:col-span-4">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum cliente encontrado para a busca.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-white/20 bg-white/40 backdrop-blur-md sm:col-span-2 lg:col-span-3 2xl:col-span-4">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="mb-4 text-muted-foreground">Nenhum cliente cadastrado</p>
              <Button onClick={() => setIsOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeiro Cliente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {filteredClients.length > CLIENTS_PER_PAGE ? (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full"
            aria-label="Página anterior"
            disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[72px] text-center text-sm font-medium text-muted-foreground">
            {safeCurrentPage} / {totalPages}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full"
            aria-label="Próxima página"
            disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Dialog open={!!detailsClient} onOpenChange={open => !open && setDetailsClient(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {detailsClient?.name}
            </DialogTitle>
            <DialogDescription>Detalhes cadastrais e comerciais do cliente.</DialogDescription>
          </DialogHeader>
          {detailsClient ? (
            <div className="grid gap-4 rounded-2xl border bg-muted/30 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">CPF/CNPJ</p>
                <p className="font-medium">{detailsClient.cpfCnpj}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Regime</p>
                <p className="font-medium">{taxRegimeLabels[(detailsClient.taxRegime || "simples_nacional") as keyof typeof taxRegimeLabels]}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><Mail className="h-3 w-3" /> E-mail</p>
                <p className="font-medium">{detailsClient.email || "Não informado"}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><Phone className="h-3 w-3" /> Telefone</p>
                <p className="font-medium">{detailsClient.phone || "Não informado"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><MapPin className="h-3 w-3" /> Endereço</p>
                <p className="font-medium">{detailsClient.address || "Não informado"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Honorário mensal</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(Number(detailsClient.monthlyFee))}</p>
              </div>
              <div className="flex flex-col gap-2 border-t pt-4 md:col-span-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const client = detailsClient;
                    setDetailsClient(null);
                    handleEdit(client);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                  Editar cliente
                </Button>
                {user?.role === "admin" ? (
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => {
                      const id = detailsClient.id;
                      setDetailsClient(null);
                      handleDelete(id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir cliente
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
