from pathlib import Path
import re
root=Path('/mnt/data/contafacil_role_update')

def rw(rel, fn):
    p=root/rel
    s=p.read_text()
    ns=fn(s)
    if ns==s:
        print('NOCHANGE',rel)
    else:
        p.write_text(ns)
        print('UPDATED',rel)

# Schema role
rw('drizzle/schema.ts', lambda s: s.replace('export type UserRole = "user" | "admin";', 'export type UserRole = "assistant" | "admin";'))

# DB role normalization and defaults
def db_mod(s):
    insert_after='''function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}
'''
    helper='''function normalizeStoredRole(role: unknown, companyId: number | null | undefined): UserRole {
  if (role === "admin") return "admin";
  if (role === "assistant") return "assistant";
  // Compatibilidade com registros criados antes da troca de nomenclatura.
  if (role === "user") return companyId ? "assistant" : "admin";
  return companyId ? "assistant" : "admin";
}
'''
    if helper not in s:
        s=s.replace(insert_after, insert_after+'\n'+helper)
    s=s.replace('''  for (const key of ["createdAt", "updatedAt", "lastSignedIn", "dueDate", "paidDate"]) {
    if (output[key]) output[key] = normalizeDate(output[key]);
  }
  return output as T;
''','''  for (const key of ["createdAt", "updatedAt", "lastSignedIn", "dueDate", "paidDate"]) {
    if (output[key]) output[key] = normalizeDate(output[key]);
  }
  if (output.role !== undefined) {
    output.role = normalizeStoredRole(output.role, output.companyId ?? null);
  }
  return output as T;
''')
    s=s.replace('''  const requestedRole = user.role || (incomingEmail && ownerEmail && incomingEmail === ownerEmail ? "admin" : "user");
''','''  const requestedRole = user.role || (incomingEmail && ownerEmail && incomingEmail === ownerEmail ? "admin" : "admin");
''')
    s=s.replace('''        role: current.role || requestedRole,
''','''        role: normalizeStoredRole(current.role, current.companyId ?? null) || requestedRole,
''')
    s=s.replace('''            loginMethod: user.loginMethod ?? stored.loginMethod ?? null,
            lastSignedIn: user.lastSignedIn || now(),
''','''            loginMethod: user.loginMethod ?? stored.loginMethod ?? null,
            role: normalizeStoredRole(stored.role, stored.companyId ?? null),
            lastSignedIn: user.lastSignedIn || now(),
''')
    return s
rw('server/db.ts', db_mod)

# Routers roles and company create admin
def routers_mod(s):
    s=s.replace('''    create: protectedProcedure
''','''    create: adminProcedure
''',1)
    s=s.replace('z.enum(["admin", "user"])','z.enum(["admin", "assistant"])')
    s=s.replace('input.role === "user"', 'input.role === "assistant"')
    return s
rw('server/routers.ts', routers_mod)

# App routes reports and company adminOnly
rw('client/src/App.tsx', lambda s: s.replace('<Route path="/reports">{() => <ProtectedPage><Reports /></ProtectedPage>}</Route>', '<Route path="/reports">{() => <ProtectedPage adminOnly><Reports /></ProtectedPage>}</Route>').replace('<Route path="/company">{() => <ProtectedPage><Company /></ProtectedPage>}</Route>', '<Route path="/company">{() => <ProtectedPage adminOnly><Company /></ProtectedPage>}</Route>'))

# Sidebar menu labels and conditional items
def layout_mod(s):
    old='''  const menuItems = useMemo(() => [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: CalendarDays, label: "Agenda", path: "/agenda" },
    { icon: Users, label: "Clientes", path: "/clients" },
    { icon: DollarSign, label: "Honorários", path: "/fees" },
    { icon: FileText, label: "Relatórios", path: "/reports" },
    { icon: Settings, label: "Empresa", path: "/company" },
    ...(user?.role === "admin" ? [{ icon: ShieldCheck, label: "Usuários", path: "/users" }] : []),
  ], [user?.role]);
'''
    new='''  const menuItems = useMemo(() => [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: CalendarDays, label: "Agenda", path: "/agenda" },
    { icon: Users, label: "Clientes", path: "/clients" },
    { icon: DollarSign, label: "Honorários", path: "/fees" },
    ...(user?.role === "admin" ? [
      { icon: FileText, label: "Relatórios", path: "/reports" },
      { icon: Settings, label: "Empresa", path: "/company" },
      { icon: ShieldCheck, label: "Assistentes", path: "/users" },
    ] : []),
  ], [user?.role]);
'''
    s=s.replace(old,new)
    s=s.replace('{user?.name || "Usuário"}', '{user?.name || "ContaFácil"}')
    s=s.replace('{user?.role === "admin" ? "Administrador" : "Usuário"}', '{user?.role === "admin" ? "Administrador" : "Assistente"}')
    return s
rw('client/src/components/DashboardLayout.tsx', layout_mod)

# Dashboard restricted received card and name fallback
def dash_mod(s):
    s=s.replace('{user?.name || "Usuário"}', '{user?.name || "ContaFácil"}')
    old='''        {/* Total Received */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido este Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : stats ? (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(Number(stats.totalReceived) || 0)}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              Honorários recebidos
            </p>
          </CardContent>
        </Card>
'''
    new='''        {/* Total Received / Assistente */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido este Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {user?.role === "admin" ? (
              <>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : stats ? (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(Number(stats.totalReceived) || 0)}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">Honorários recebidos</p>
              </>
            ) : (
              <div className="rounded-xl border border-white/30 bg-white/35 px-3 py-2 text-sm text-muted-foreground">
                Disponível apenas para administradores.
              </div>
            )}
          </CardContent>
        </Card>
'''
    if old not in s:
        print('dashboard card pattern not found')
    s=s.replace(old,new)
    return s
rw('client/src/pages/Dashboard.tsx', dash_mod)

# Users UI role rename
def users_mod(s):
    replacements={
        'role: z.enum(["admin", "user"])':'role: z.enum(["admin", "assistant"])',
        'role: "user"':'role: "assistant"',
        '"Usuário pré-autorizado com sucesso."':'"Assistente pré-autorizado com sucesso."',
        '"Usuário atualizado com sucesso."':'"Assistente atualizado com sucesso."',
        '"Usuário removido com sucesso."':'"Assistente removido com sucesso."',
        'Somente administradores podem gerenciar usuários.':'Somente administradores podem gerenciar assistentes.',
        '>Usuários<':'>Assistentes<',
        'Gerencie administradores e usuários autorizados da empresa.':'Gerencie administradores e assistentes autorizados da empresa.',
        'Novo Usuário':'Novo Assistente',
        'Editar Usuário':'Editar Assistente',
        'Pré-autorizar Usuário':'Pré-autorizar Assistente',
        'Nome do usuário':'Nome do assistente',
        '<SelectItem value="user">Usuário</SelectItem>':'<SelectItem value="assistant">Assistente</SelectItem>',
        '>Usuário</th>':'>Assistente</th>',
        '{item.role === "admin" ? "Administrador" : "Usuário"}':'{item.role === "admin" ? "Administrador" : "Assistente"}',
        'Contas autorizadas a acessar o sistema da empresa.':'Assistentes autorizados a acessar o sistema da empresa.',
        'Criar usuário':'Criar assistente',
        'Nenhum usuário cadastrado.':'Nenhum assistente cadastrado.',
    }
    for a,b in replacements.items(): s=s.replace(a,b)
    return s
rw('client/src/pages/Users.tsx', users_mod)

# Register wording
rw('client/src/pages/Register.tsx', lambda s: s.replace('Usuários pré-autorizados também entram por aqui.', 'Assistentes pré-autorizados também entram por aqui.'))

# Company: defensive block message for non-admin if accessed accidentally
def company_mod(s):
    marker='''export default function Company() {
  const { user, refresh: refreshAuth } = useAuth();
'''
    replace='''export default function Company() {
  const { user, refresh: refreshAuth } = useAuth();
'''
    # app route already handles; no UI needed to avoid unused card imports adjustments
    return s
rw('client/src/pages/Company.tsx', company_mod)

# Clients search
def clients_mod(s):
    s=s.replace('import { useEffect, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')
    s=s.replace('MapPin, ChevronLeft, ChevronRight }', 'MapPin, ChevronLeft, ChevronRight, Search }')
    s=s.replace('''  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
''','''  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
''')
    old='''  const totalPages = Math.max(1, Math.ceil(clients.length / CLIENTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleClients = clients.slice(
    (safeCurrentPage - 1) * CLIENTS_PER_PAGE,
    safeCurrentPage * CLIENTS_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
'''
    new='''  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("pt-BR");
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
'''
    if old not in s: print('clients pagination pattern not found')
    s=s.replace(old,new)
    # Insert search subtle below heading row and before grid
    anchor='''      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
'''
    search='''      </div>

      <div className="flex justify-end">
        <div className="relative w-full sm:w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Buscar clientes"
            className="h-10 rounded-full border-white/30 bg-white/45 pl-9 pr-4 shadow-none backdrop-blur-md focus-visible:ring-1"
            aria-label="Buscar clientes"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
'''
    if anchor not in s: print('clients insert anchor not found')
    s=s.replace(anchor,search,1)
    s=s.replace('''        ) : clients.length > 0 ? (
          visibleClients.map(client => (
''','''        ) : clients.length > 0 ? (
          filteredClients.length > 0 ? visibleClients.map(client => (
''')
    # close ternary before existing empty fallback for clients? Need inspect later. Replace known map ending + fallback sequence.
    old2='''          ))
        ) : (
          <Card className="border-white/20 bg-white/40 backdrop-blur-md sm:col-span-2 lg:col-span-3 2xl:col-span-4">
'''
    new2='''          )) : (
            <Card className="border-white/20 bg-white/40 backdrop-blur-md sm:col-span-2 lg:col-span-3 2xl:col-span-4">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">Nenhum cliente encontrado para a busca.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="border-white/20 bg-white/40 backdrop-blur-md sm:col-span-2 lg:col-span-3 2xl:col-span-4">
'''
    if old2 not in s: print('clients ternary pattern not found')
    s=s.replace(old2,new2,1)
    s=s.replace('{clients.length > CLIENTS_PER_PAGE ? (', '{filteredClients.length > CLIENTS_PER_PAGE ? (')
    return s
rw('client/src/pages/Clients.tsx', clients_mod)

# Tests roles
rw('server/auth.logout.test.ts', lambda s: s.replace('role: "user"', 'role: "assistant"'))

# README/todo light replacements
for rel in ['README.md','todo.md']:
    p=root/rel
    s=p.read_text()
    ns=s.replace('usuários autorizados','assistentes autorizados').replace('Usuários','Assistentes').replace('usuários','assistentes').replace('"user"','"assistant"')
    if ns!=s:
        p.write_text(ns)
        print('UPDATED',rel)
