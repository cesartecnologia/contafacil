import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function safeText(value: unknown) {
  return String(value ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");
}

export default function Reports() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const { data: fees = [], isLoading: feesLoading } = trpc.fees.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );
  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );
  const { data: company } = trpc.company.getByOwner.useQuery(undefined, { enabled: !!user });

  const filteredFees = fees.filter(fee => {
    if (filterStatus !== "all" && fee.status !== filterStatus) return false;
    if (filterClient !== "all" && fee.clientId !== Number.parseInt(filterClient, 10)) return false;
    if (filterStartDate && fee.competence < filterStartDate) return false;
    if (filterEndDate && fee.competence > filterEndDate) return false;
    return true;
  });

  const totalAmount = filteredFees.reduce((sum, fee) => sum + Number(fee.amount), 0);
  const paidAmount = filteredFees.filter(fee => fee.status === "paid").reduce((sum, fee) => sum + Number(fee.amount), 0);
  const pendingAmount = filteredFees.filter(fee => fee.status === "pending").reduce((sum, fee) => sum + Number(fee.amount), 0);
  const overdueAmount = filteredFees.filter(fee => fee.status === "overdue").reduce((sum, fee) => sum + Number(fee.amount), 0);

  const statusData = [
    { name: "Pago", value: paidAmount, color: "#16a34a" },
    { name: "Pendente", value: pendingAmount, color: "#d97706" },
    { name: "Vencido", value: overdueAmount, color: "#dc2626" },
  ].filter(item => item.value > 0);

  const monthlyData = Object.entries(
    filteredFees.reduce((acc, fee) => {
      acc[fee.competence] = (acc[fee.competence] || 0) + Number(fee.amount);
      return acc;
    }, {} as Record<string, number>)
  )
    .sort()
    .map(([month, valor]) => ({ month, valor }));

  const getStatusLabel = (status: string) => status === "paid" ? "Pago" : status === "overdue" ? "Vencido" : "Pendente";
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500">Pago</Badge>;
      case "pending": return <Badge className="bg-yellow-500">Pendente</Badge>;
      case "overdue": return <Badge className="bg-red-500">Vencido</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };
  const getClientName = (clientId: number) => clients.find(client => client.id === clientId)?.name || "Cliente desconhecido";

  const downloadCsv = () => {
    const headers = ["Cliente", "Competência", "Valor", "Vencimento", "Status"];
    const rows = filteredFees.map(fee => [
      getClientName(fee.clientId),
      fee.competence,
      formatCurrency(Number(fee.amount)),
      new Date(fee.dueDate).toLocaleDateString("pt-BR"),
      getStatusLabel(fee.status),
    ]);
    const csv = [headers.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `relatorio-contafacil-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Relatório CSV exportado com sucesso!");
  };

  const downloadPdf = async () => {
    if (filteredFees.length === 0) return;
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([842, 595]);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 36;
    let y = 552;
    const width = page.getWidth();
    const red = rgb(0.72, 0.08, 0.12);
    const text = rgb(0.13, 0.13, 0.16);

    const drawText = (value: string, x: number, yPos: number, size = 10, isBold = false, color = text) => {
      page.drawText(safeText(value), { x, y: yPos, size, font: isBold ? bold : regular, color });
    };
    const newPage = () => {
      page = pdfDoc.addPage([842, 595]);
      y = 552;
      drawPageHeader();
      y -= 38;
      drawTableHeader();
    };
    const drawPageHeader = () => {
      page.drawRectangle({ x: 0, y: 560, width, height: 35, color: red });
      drawText("ContaFácil | Relatório Financeiro", margin, 572, 14, true, rgb(1, 1, 1));
    };
    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 22, color: rgb(0.96, 0.91, 0.92) });
      drawText("Cliente", margin + 8, y, 9, true);
      drawText("Competência", 305, y, 9, true);
      drawText("Valor", 405, y, 9, true);
      drawText("Vencimento", 505, y, 9, true);
      drawText("Status", 645, y, 9, true);
      y -= 24;
    };

    drawPageHeader();
    y -= 34;
    drawText(company?.legalName || "Escritório contábil", margin, y, 15, true);
    y -= 18;
    drawText(`Gerado em ${new Date().toLocaleString("pt-BR")} | ${filteredFees.length} registro(s)`, margin, y, 9);
    y -= 22;

    page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 42, borderColor: rgb(0.88, 0.83, 0.84), borderWidth: 1, color: rgb(0.995, 0.985, 0.986) });
    drawText(`Total: ${formatCurrency(totalAmount)}`, margin + 12, y + 12, 11, true, red);
    drawText(`Pagos: ${formatCurrency(paidAmount)}`, 245, y + 12, 10, true);
    drawText(`Pendentes: ${formatCurrency(pendingAmount)}`, 405, y + 12, 10, true);
    drawText(`Vencidos: ${formatCurrency(overdueAmount)}`, 605, y + 12, 10, true);
    y -= 54;
    drawTableHeader();

    for (const fee of filteredFees) {
      if (y < 48) newPage();
      drawText(getClientName(fee.clientId).slice(0, 42), margin + 8, y, 9);
      drawText(fee.competence, 305, y, 9);
      drawText(formatCurrency(Number(fee.amount)), 405, y, 9);
      drawText(new Date(fee.dueDate).toLocaleDateString("pt-BR"), 505, y, 9);
      drawText(getStatusLabel(fee.status), 645, y, 9);
      page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: width - margin, y: y - 7 }, thickness: 0.5, color: rgb(0.87, 0.87, 0.87) });
      y -= 20;
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `relatorio-contafacil-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Relatório PDF exportado com sucesso!");
  };

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterClient("all");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  const activeFilters = [filterStatus !== "all", filterClient !== "all", !!filterStartDate, !!filterEndDate].filter(Boolean).length;
  const isLoading = feesLoading || clientsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
          <p className="mt-1 text-muted-foreground">Analise seus honorários e exporte em CSV ou PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros {activeFilters ? `(${activeFilters})` : ""}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px]">
              <DialogHeader>
                <DialogTitle>Filtros do relatório</DialogTitle>
                <DialogDescription>Refine os resultados sem ocupar a tela principal.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="status-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="client-filter">Cliente</Label>
                  <Select value={filterClient} onValueChange={setFilterClient}>
                    <SelectTrigger id="client-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {clients.map(client => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="start-date-filter">Competência inicial</Label>
                  <Input id="start-date-filter" type="month" value={filterStartDate} onChange={event => setFilterStartDate(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end-date-filter">Competência final</Label>
                  <Input id="end-date-filter" type="month" value={filterEndDate} onChange={event => setFilterEndDate(event.target.value)} />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
                <Button onClick={() => setFilterOpen(false)}>Aplicar filtros</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={downloadCsv} className="gap-2" disabled={filteredFees.length === 0}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => void downloadPdf()} className="gap-2" disabled={filteredFees.length === 0}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Pago</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "paid").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Pendente</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "pending").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Vencido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "overdue").length} registros</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader><CardTitle>Evolução Mensal</CardTitle><CardDescription>Valores por competência</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-80" /> : monthlyData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                  <XAxis dataKey="month" tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={78}
                    tickFormatter={value => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(185, 28, 28, 0.06)" }}
                    formatter={(value) => [formatCurrency(value as number), "Valor"]}
                    labelFormatter={label => `Competência: ${label}`}
                  />
                  <Bar dataKey="valor" name="Valor" fill="#b91c1c" radius={[10, 10, 4, 4]} maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-80 items-center justify-center text-muted-foreground">Nenhum dado disponível</div>}
          </CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader><CardTitle>Distribuição por Status</CardTitle><CardDescription>Proporção de honorários</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-80" /> : statusData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-80 items-center justify-center text-muted-foreground">Nenhum dado disponível</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/20 bg-white/40 backdrop-blur-md">
        <CardHeader><CardTitle>Detalhes dos Honorários</CardTitle><CardDescription>Lista completa dos honorários filtrados</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : filteredFees.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {filteredFees.map(fee => (
                  <div key={`report-mobile-${fee.id}`} className="rounded-2xl border border-white/30 bg-white/45 p-4 shadow-sm backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{getClientName(fee.clientId)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Competência {fee.competence}</p>
                      </div>
                      <div>{getStatusBadge(fee.status)}</div>
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
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.map(fee => (
                    <tr key={fee.id} className="border-b transition-colors hover:bg-white/20">
                      <td className="px-4 py-3">{getClientName(fee.clientId)}</td>
                      <td className="px-4 py-3">{fee.competence}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(fee.amount))}</td>
                      <td className="px-4 py-3">{new Date(fee.dueDate).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(fee.status)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          ) : <div className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">Nenhum honorário encontrado com os filtros aplicados</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
