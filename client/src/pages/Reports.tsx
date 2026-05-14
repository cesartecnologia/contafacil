import { useMemo, useState } from "react";
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

function getFeeStatusLabel(status: string) {
  return status === "paid" ? "Pago" : status === "overdue" ? "Vencido" : "Pendente";
}

function getServiceStatusLabel(status: string) {
  return status === "paid" ? "Pago" : "Pendente";
}

function getFeeStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-500">Pago</Badge>;
    case "pending": return <Badge className="bg-yellow-500">Pendente</Badge>;
    case "overdue": return <Badge className="bg-red-500">Vencido</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

function getServiceStatusBadge(status: string) {
  return status === "paid"
    ? <Badge className="bg-green-500">Pago</Badge>
    : <Badge className="bg-yellow-500">Pendente</Badge>;
}

function dateInputValue(value: unknown) {
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default function Reports() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  const [filterOpen, setFilterOpen] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const [serviceClient, setServiceClient] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("all");
  const [serviceStatus, setServiceStatus] = useState<string>("all");
  const [servicePaymentMethod, setServicePaymentMethod] = useState<string>("all");
  const [serviceStartDate, setServiceStartDate] = useState<string>("");
  const [serviceEndDate, setServiceEndDate] = useState<string>("");

  const { data: fees = [], isLoading: feesLoading } = trpc.fees.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );
  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );
  const { data: services = [], isLoading: servicesLoading } = trpc.services.listByCompany.useQuery(
    companyId || 0,
    { enabled: !!companyId }
  );
  const { data: company } = trpc.company.getByOwner.useQuery(undefined, { enabled: !!user });

  const filteredFees = useMemo(() => fees.filter(fee => {
    if (filterStatus !== "all" && fee.status !== filterStatus) return false;
    if (filterClient !== "all" && fee.clientId !== Number.parseInt(filterClient, 10)) return false;
    if (filterStartDate && fee.competence < filterStartDate) return false;
    if (filterEndDate && fee.competence > filterEndDate) return false;
    return true;
  }), [fees, filterClient, filterEndDate, filterStartDate, filterStatus]);

  const normalizedServiceClient = serviceClient.trim().toLocaleLowerCase("pt-BR");
  const filteredServices = useMemo(() => services.filter(service => {
    const date = dateInputValue(service.serviceDate);
    if (normalizedServiceClient && !service.clientName.toLocaleLowerCase("pt-BR").includes(normalizedServiceClient)) return false;
    if (serviceType !== "all" && service.serviceType !== serviceType) return false;
    if (serviceStatus !== "all" && service.paymentStatus !== serviceStatus) return false;
    if (servicePaymentMethod !== "all" && (service.paymentMethod || "") !== servicePaymentMethod) return false;
    if (serviceStartDate && date < serviceStartDate) return false;
    if (serviceEndDate && date > serviceEndDate) return false;
    return true;
  }), [normalizedServiceClient, serviceEndDate, servicePaymentMethod, serviceStartDate, serviceStatus, serviceType, services]);

  const totalAmount = filteredFees.reduce((sum, fee) => sum + Number(fee.amount), 0);
  const paidAmount = filteredFees.filter(fee => fee.status === "paid").reduce((sum, fee) => sum + Number(fee.amount), 0);
  const pendingAmount = filteredFees.filter(fee => fee.status === "pending").reduce((sum, fee) => sum + Number(fee.amount), 0);
  const overdueAmount = filteredFees.filter(fee => fee.status === "overdue").reduce((sum, fee) => sum + Number(fee.amount), 0);

  const servicesTotalAmount = filteredServices.reduce((sum, service) => sum + Number(service.amount), 0);
  const servicesPaidAmount = filteredServices.filter(service => service.paymentStatus === "paid").reduce((sum, service) => sum + Number(service.amount), 0);
  const servicesPendingAmount = filteredServices.filter(service => service.paymentStatus === "pending").reduce((sum, service) => sum + Number(service.amount), 0);

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

  const serviceTypeTotals = Object.entries(
    filteredServices.reduce((acc, service) => {
      acc[service.serviceType] = (acc[service.serviceType] || 0) + Number(service.amount);
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([a], [b]) => (serviceTypeLabels[a] || a).localeCompare(serviceTypeLabels[b] || b, "pt-BR"))
    .map(([type, total]) => ({ type, label: serviceTypeLabels[type] || type, total }));

  const getClientName = (clientId: number) => clients.find(client => client.id === clientId)?.name || "Cliente desconhecido";

  const downloadCsv = () => {
    const feeHeaders = ["Origem", "Cliente", "Descrição", "Valor", "Data", "Status", "Forma de pagamento"];
    const feeRows = filteredFees.map(fee => [
      "Honorário",
      getClientName(fee.clientId),
      fee.competence,
      formatCurrency(Number(fee.amount)),
      new Date(fee.dueDate).toLocaleDateString("pt-BR"),
      getFeeStatusLabel(fee.status),
      getPaymentMethodLabel(fee.paymentMethod),
    ]);
    const serviceRows = filteredServices.map(service => [
      "Serviço",
      service.clientName,
      serviceTypeLabels[service.serviceType] || service.serviceType,
      formatCurrency(Number(service.amount)),
      new Date(service.serviceDate).toLocaleDateString("pt-BR"),
      getServiceStatusLabel(service.paymentStatus),
      getPaymentMethodLabel(service.paymentMethod),
    ]);
    const rows = [...feeRows, ...serviceRows];
    const csv = [feeHeaders.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(","))].join("\n");
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
    if (filteredFees.length === 0 && filteredServices.length === 0) return;
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
    const drawPageHeader = () => {
      page.drawRectangle({ x: 0, y: 560, width, height: 35, color: red });
      drawText("ContaFácil | Relatório Financeiro", margin, 572, 14, true, rgb(1, 1, 1));
    };
    const newPage = () => {
      page = pdfDoc.addPage([842, 595]);
      y = 552;
      drawPageHeader();
      y -= 42;
    };

    const ensureSpace = (space: number) => {
      if (y - space < 42) newPage();
    };

    drawPageHeader();
    y -= 34;
    drawText(company?.legalName || "Escritório contábil", margin, y, 15, true);
    y -= 18;
    drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, y, 9);
    y -= 28;

    page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 42, borderColor: rgb(0.88, 0.83, 0.84), borderWidth: 1, color: rgb(0.995, 0.985, 0.986) });
    drawText(`Honorários: ${formatCurrency(totalAmount)}`, margin + 12, y + 12, 10, true, red);
    drawText(`Serviços: ${formatCurrency(servicesTotalAmount)}`, 275, y + 12, 10, true, red);
    drawText(`Total geral: ${formatCurrency(totalAmount + servicesTotalAmount)}`, 520, y + 12, 10, true, red);
    y -= 58;

    ensureSpace(90);
    drawText("Resumo de honorários", margin, y, 12, true, red);
    y -= 18;
    drawText(`Total: ${formatCurrency(totalAmount)} | Pago: ${formatCurrency(paidAmount)} | Pendente: ${formatCurrency(pendingAmount)} | Vencido: ${formatCurrency(overdueAmount)}`, margin, y, 9);
    y -= 22;
    page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 22, color: rgb(0.96, 0.91, 0.92) });
    drawText("Cliente", margin + 8, y, 9, true);
    drawText("Competência", 305, y, 9, true);
    drawText("Valor", 405, y, 9, true);
    drawText("Vencimento", 505, y, 9, true);
    drawText("Status", 645, y, 9, true);
    y -= 24;

    for (const fee of filteredFees) {
      ensureSpace(20);
      drawText(getClientName(fee.clientId).slice(0, 42), margin + 8, y, 9);
      drawText(fee.competence, 305, y, 9);
      drawText(formatCurrency(Number(fee.amount)), 405, y, 9);
      drawText(new Date(fee.dueDate).toLocaleDateString("pt-BR"), 505, y, 9);
      drawText(getFeeStatusLabel(fee.status), 645, y, 9);
      page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: width - margin, y: y - 7 }, thickness: 0.5, color: rgb(0.87, 0.87, 0.87) });
      y -= 20;
    }

    y -= 18;
    ensureSpace(120);
    drawText("Resumo de serviços", margin, y, 12, true, red);
    y -= 18;
    drawText(`Total: ${formatCurrency(servicesTotalAmount)} | Pago: ${formatCurrency(servicesPaidAmount)} | Pendente: ${formatCurrency(servicesPendingAmount)}`, margin, y, 9);
    y -= 22;
    page.drawRectangle({ x: margin, y: y - 6, width: width - margin * 2, height: 22, color: rgb(0.96, 0.91, 0.92) });
    drawText("Cliente", margin + 8, y, 9, true);
    drawText("Serviço", 255, y, 9, true);
    drawText("Valor", 430, y, 9, true);
    drawText("Data", 530, y, 9, true);
    drawText("Status", 645, y, 9, true);
    y -= 24;

    for (const service of filteredServices) {
      ensureSpace(20);
      drawText(service.clientName.slice(0, 34), margin + 8, y, 9);
      drawText((serviceTypeLabels[service.serviceType] || service.serviceType).slice(0, 25), 255, y, 9);
      drawText(formatCurrency(Number(service.amount)), 430, y, 9);
      drawText(new Date(service.serviceDate).toLocaleDateString("pt-BR"), 530, y, 9);
      drawText(getServiceStatusLabel(service.paymentStatus), 645, y, 9);
      page.drawLine({ start: { x: margin, y: y - 7 }, end: { x: width - margin, y: y - 7 }, thickness: 0.5, color: rgb(0.87, 0.87, 0.87) });
      y -= 20;
    }

    if (serviceTypeTotals.length > 0) {
      y -= 18;
      ensureSpace(30 + serviceTypeTotals.length * 16);
      drawText("Totais por tipo de serviço", margin, y, 11, true, red);
      y -= 18;
      for (const item of serviceTypeTotals) {
        ensureSpace(16);
        drawText(`${item.label}: ${formatCurrency(item.total)}`, margin + 8, y, 9);
        y -= 16;
      }
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
    setServiceClient("");
    setServiceType("all");
    setServiceStatus("all");
    setServicePaymentMethod("all");
    setServiceStartDate("");
    setServiceEndDate("");
  };

  const activeFilters = [
    filterStatus !== "all",
    filterClient !== "all",
    !!filterStartDate,
    !!filterEndDate,
    !!serviceClient,
    serviceType !== "all",
    serviceStatus !== "all",
    servicePaymentMethod !== "all",
    !!serviceStartDate,
    !!serviceEndDate,
  ].filter(Boolean).length;
  const isLoading = feesLoading || clientsLoading || servicesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
          <p className="mt-1 text-muted-foreground">Analise honorários e serviços, com exportação em CSV ou PDF.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros {activeFilters ? `(${activeFilters})` : ""}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
              <DialogHeader>
                <DialogTitle>Filtros do relatório</DialogTitle>
                <DialogDescription>Refine honorários e serviços sem ocupar a tela principal.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Honorários</h3>
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
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Serviços</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="service-client-filter">Cliente</Label>
                      <Input id="service-client-filter" value={serviceClient} onChange={event => setServiceClient(event.target.value)} placeholder="Buscar pelo nome" />
                    </div>
                    <div>
                      <Label htmlFor="service-type-filter">Tipo de serviço</Label>
                      <Select value={serviceType} onValueChange={setServiceType}>
                        <SelectTrigger id="service-type-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {Object.entries(serviceTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="service-status-filter">Status do pagamento</Label>
                      <Select value={serviceStatus} onValueChange={setServiceStatus}>
                        <SelectTrigger id="service-status-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="service-payment-method-filter">Forma de pagamento</Label>
                      <Select value={servicePaymentMethod} onValueChange={setServicePaymentMethod}>
                        <SelectTrigger id="service-payment-method-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {Object.entries(paymentMethodLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="service-start-date-filter">Período inicial</Label>
                      <Input id="service-start-date-filter" type="date" value={serviceStartDate} onChange={event => setServiceStartDate(event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="service-end-date-filter">Período final</Label>
                      <Input id="service-end-date-filter" type="date" value={serviceEndDate} onChange={event => setServiceEndDate(event.target.value)} />
                    </div>
                  </div>
                </section>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
                <Button onClick={() => setFilterOpen(false)}>Aplicar filtros</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={downloadCsv} className="gap-2" disabled={filteredFees.length === 0 && filteredServices.length === 0}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => void downloadPdf()} className="gap-2" disabled={filteredFees.length === 0 && filteredServices.length === 0}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Honorários</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Honorários Pagos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "paid").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Honorários Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "pending").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Honorários Vencidos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredFees.filter(fee => fee.status === "overdue").length} registros</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Serviços</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(servicesTotalAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredServices.length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Serviços Pagos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(servicesPaidAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredServices.filter(service => service.paymentStatus === "paid").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Serviços Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(servicesPendingAmount)}</div><p className="mt-1 text-xs text-muted-foreground">{filteredServices.filter(service => service.paymentStatus === "pending").length} registros</p></CardContent>
        </Card>
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary">Total Geral</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalAmount + servicesTotalAmount)}</div><p className="mt-1 text-xs text-muted-foreground">Honorários + serviços</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/20 bg-white/40 backdrop-blur-md">
          <CardHeader><CardTitle>Evolução Mensal</CardTitle><CardDescription>Valores de honorários por competência</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-80" /> : monthlyData.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                  <XAxis dataKey="month" tickMargin={10} axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} width={78} tickFormatter={value => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} />
                  <Tooltip cursor={{ fill: "rgba(185, 28, 28, 0.06)" }} formatter={(value) => [formatCurrency(value as number), "Valor"]} labelFormatter={label => `Competência: ${label}`} />
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
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${formatCurrency(value)}`} outerRadius={80} dataKey="value">
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
        <CardHeader><CardTitle>Totais por Tipo de Serviço</CardTitle><CardDescription>Consolidação financeira dos serviços filtrados</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : serviceTypeTotals.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {serviceTypeTotals.map(item => (
                <div key={item.type} className="rounded-2xl border border-white/30 bg-white/45 p-4 shadow-sm backdrop-blur-md">
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-xl font-bold text-primary">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum serviço encontrado para consolidar.</p>
          )}
        </CardContent>
      </Card>

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
                      <div>{getFeeStatusBadge(fee.status)}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold text-primary">{formatCurrency(Number(fee.amount))}</p></div>
                      <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">{new Date(fee.dueDate).toLocaleDateString("pt-BR")}</p></div>
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
                        <td className="px-4 py-3 text-center">{getFeeStatusBadge(fee.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">Nenhum honorário encontrado com os filtros aplicados</p></div>}
        </CardContent>
      </Card>

      <Card className="border-white/20 bg-white/40 backdrop-blur-md">
        <CardHeader><CardTitle>Detalhes dos Serviços</CardTitle><CardDescription>Lista completa dos serviços filtrados</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : filteredServices.length ? (
            <>
              <div className="space-y-3 md:hidden">
                {filteredServices.map(service => (
                  <div key={`service-report-mobile-${service.id}`} className="rounded-2xl border border-white/30 bg-white/45 p-4 shadow-sm backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{service.clientName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{serviceTypeLabels[service.serviceType] || service.serviceType}</p>
                      </div>
                      <div>{getServiceStatusBadge(service.paymentStatus)}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-semibold text-primary">{formatCurrency(Number(service.amount))}</p></div>
                      <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{new Date(service.serviceDate).toLocaleDateString("pt-BR")}</p></div>
                      <div><p className="text-xs text-muted-foreground">Pagamento</p><p className="font-medium">{getPaymentMethodLabel(service.paymentMethod)}</p></div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map(service => (
                      <tr key={service.id} className="border-b transition-colors hover:bg-white/20">
                        <td className="px-4 py-3">{service.clientName}</td>
                        <td className="px-4 py-3">{serviceTypeLabels[service.serviceType] || service.serviceType}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(service.amount))}</td>
                        <td className="px-4 py-3">{new Date(service.serviceDate).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">{getPaymentMethodLabel(service.paymentMethod)}</td>
                        <td className="px-4 py-3 text-center">{getServiceStatusBadge(service.paymentStatus)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">Nenhum serviço encontrado com os filtros aplicados</p></div>}
        </CardContent>
      </Card>
    </div>
  );
}
