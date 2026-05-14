import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Edit2, MoreVertical, Plus, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useConfirmDialog } from "@/components/ConfirmDialogProvider";

const userSchema = z.object({
  name: z.string().min(2, "Informe o nome do usuário"),
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().max(128, "A senha é muito longa").optional(),
  confirmPassword: z.string().max(128, "A confirmação de senha é muito longa").optional(),
  role: z.enum(["admin", "assistant"]),
});

type UserFormData = z.infer<typeof userSchema>;

const emptyFormValues: UserFormData = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "assistant",
};

export default function Users() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { confirm } = useConfirmDialog();
  const { data: users = [], isLoading, refetch } = trpc.users.listByCompany.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: emptyFormValues,
  });

  const closeDialogAndReset = () => {
    setIsOpen(false);
    setEditingId(null);
    form.reset(emptyFormValues);
  };

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso.");
      closeDialogAndReset();
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso.");
      closeDialogAndReset();
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido com sucesso.");
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const summary = useMemo(() => ({
    total: users.length,
    admins: users.filter(item => item.role === "admin").length,
    assistants: users.filter(item => item.role === "assistant").length,
  }), [users]);

  const onSubmit = (data: UserFormData) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: data.name, role: data.role });
      return;
    }

    const password = data.password?.trim() ?? "";
    const confirmPassword = data.confirmPassword?.trim() ?? "";

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    createMutation.mutate({
      name: data.name,
      email: data.email,
      password,
      role: data.role,
    });
  };

  const handleEdit = (item: typeof users[number]) => {
    setEditingId(item.id);
    form.reset({
      name: item.name || "",
      email: item.email || "",
      password: "",
      confirmPassword: "",
      role: item.role,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Remover usuário",
      description: "Tem certeza que deseja remover este usuário? Esta ação não poderá ser desfeita.",
      confirmText: "Remover",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  if (user?.role !== "admin") {
    return (
      <Card className="backdrop-blur-md bg-white/40 border-white/20">
        <CardHeader>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>Somente administradores podem gerenciar usuários.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie os acessos da equipe ao ContaFácil.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={open => {
          setIsOpen(open);
          if (!open) {
            setEditingId(null);
            form.reset(emptyFormValues);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar usuário" : "Criar usuário"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Atualize o nome e o nível de acesso."
                  : "Cadastre o usuário com e-mail, senha e cargo de acesso."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input placeholder="Nome do usuário" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input disabled={!!editingId} type="email" placeholder="usuario@empresa.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {!editingId ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl><Input type="password" autoComplete="new-password" placeholder="Mín. 6 caracteres" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar senha</FormLabel>
                        <FormControl><Input type="password" autoComplete="new-password" placeholder="Repita a senha" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                ) : null}
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="assistant">Assistente</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Salvar alterações" : "Criar usuário"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.total}</div></CardContent>
        </Card>
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Administradores</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.admins}</div></CardContent>
        </Card>
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Assistentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.assistants}</div></CardContent>
        </Card>
      </div>

      <Card className="backdrop-blur-md bg-white/40 border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRoundCog className="h-5 w-5" /> Usuários cadastrados</CardTitle>
          <CardDescription>Acompanhe os acessos ativos da equipe.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Nenhum usuário cadastrado.</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {users.map(item => {
                  const pending = item.openId?.startsWith("pending:");
                  return (
                    <div key={`mobile-user-${item.id}`} className="rounded-2xl border border-white/30 bg-white/45 p-4 shadow-sm backdrop-blur-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{item.name || "Sem nome"}</p>
                          <p className="truncate text-sm text-muted-foreground">{item.email || "Sem e-mail"}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Abrir ações do usuário"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)}><Edit2 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(item.id)} disabled={item.id === user?.id}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant={item.role === "admin" ? "default" : "secondary"} className="gap-1">
                          {item.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : null}
                          {item.role === "admin" ? "Administrador" : "Assistente"}
                        </Badge>
                        <Badge variant={pending ? "outline" : "secondary"}>{pending ? "Pendente" : "Ativo"}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 font-semibold">Usuário</th>
                      <th className="px-4 py-3 font-semibold">Cargo</th>
                      <th className="px-4 py-3 font-semibold">Situação</th>
                      <th className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(item => {
                      const pending = item.openId?.startsWith("pending:");
                      return (
                        <tr key={item.id} className="border-b hover:bg-white/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.name || "Sem nome"}</div>
                            <div className="text-sm text-muted-foreground">{item.email || "Sem e-mail"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={item.role === "admin" ? "default" : "secondary"} className="gap-1">
                              {item.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : null}
                              {item.role === "admin" ? "Administrador" : "Assistente"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={pending ? "outline" : "secondary"}>{pending ? "Pendente" : "Ativo"}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" aria-label="Abrir ações do usuário">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(item)}>
                                    <Edit2 className="mr-2 h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(item.id)} disabled={item.id === user?.id}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
