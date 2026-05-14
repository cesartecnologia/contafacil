import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DollarSign, Users, Clock, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const companyId = user?.companyId;

  const { data: stats, isLoading: statsLoading } = trpc.dashboardStats.getStats.useQuery(
    { companyId: companyId || 0 },
    { enabled: !!companyId }
  );

  const { data: fees, isLoading: feesLoading } = trpc.fees.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );

  const { data: notifications = [], isLoading: notificationsLoading } = trpc.notifications.listByUser.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const unreadNotifications = notifications.filter(notification => notification.isRead !== "true");

  // Prepare data for monthly chart in chronological order.
  // The API can return the newest fees first, so the chart must be sorted by competence.
  const monthlyData = Object.entries(
    (fees || []).reduce((acc, fee) => {
      const month = fee.competence;
      acc[month] = (acc[month] || 0) + Number(fee.amount || 0);
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
    .map(([month, total]) => ({ month, total }));

  const formatCompetenceLabel = (competence: string) => {
    const [year, month] = competence.split("-");
    return month && year ? `${month}/${year}` : competence;
  };

  const isLoading = statsLoading || feesLoading;

  return (
    <div className="space-y-8">
      {/* Header with greeting */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Olá, {user?.name || "ContaFácil"}! 👋
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao seu painel de controle de honorários contábeis
        </p>
      </div>

      <Card className="backdrop-blur-md bg-white/40 border-white/20">
        <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <CardTitle>Alertas recentes</CardTitle>
            <CardDescription>Honorários, vencimentos e lembretes da agenda</CardDescription>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {notificationsLoading ? "..." : `${unreadNotifications.length} nova(s)`}
          </div>
        </CardHeader>
        <CardContent>
          {notificationsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : unreadNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta pendente no momento.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {unreadNotifications.slice(0, 4).map(notification => (
                <div key={notification.id} className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Received / Assistente */}
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

        {/* Active Clients */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : stats ? (
              <div className="text-2xl font-bold text-red-600">
                {(stats.activeClients as number) || 0}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              Clientes cadastrados
            </p>
          </CardContent>
        </Card>

        {/* Pending Fees */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : stats ? (
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(Number(stats.pendingAmount) || 0)}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.pendingCount as number) || 0} honorários
            </p>
          </CardContent>
        </Card>

        {/* Overdue Fees */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20 hover:bg-white/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : stats ? (
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(Number(stats.overdueAmount) || 0)}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              {(stats?.overdueCount as number) || 0} honorários
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Evolution Chart */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
            <CardDescription>
              Honorários registrados por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="month" tickFormatter={formatCompetenceLabel} stroke="rgba(0,0,0,0.5)" />
                  <YAxis stroke="rgba(0,0,0,0.5)" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.95)",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#b91c1c" 
                    strokeWidth={2}
                    dot={{ fill: "#b91c1c", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total de Honorários"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="backdrop-blur-md bg-white/40 border-white/20">
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>
              Honorários por situação de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">Pagos</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats ? formatCurrency(Number(stats.totalReceived) || 0) : "R$ 0,00"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium">Pendentes</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats ? formatCurrency(Number(stats.pendingAmount) || 0) : "R$ 0,00"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium">Vencidos</span>
                  </div>
                  <span className="text-sm font-bold">
                    {stats ? formatCurrency(Number(stats.overdueAmount) || 0) : "R$ 0,00"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
