import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, TriangleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TaxRegime = "mei" | "simples_nacional" | "lucro_presumido" | "lucro_real";
type ImportRow = { name: string; cpfCnpj: string; phone?: string; email?: string; address?: string; monthlyFee?: string; notes?: string; taxRegime?: TaxRegime };
type PreviewRow = { rowNumber: number; data: ImportRow; errors: string[]; duplicate: boolean };

const taxAliases: Record<string, TaxRegime> = {
  "mei": "mei", "microempreendedorindividual": "mei", "simples": "simples_nacional", "simplesnacional": "simples_nacional",
  "lucropresumido": "lucro_presumido", "presumido": "lucro_presumido", "lucroreal": "lucro_real", "real": "lucro_real",
};
function cleanKey(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function onlyDigits(value?: string | null) { return (value || "").replace(/\D/g, ""); }
function money(value?: string) {
  const raw = (value || "").trim(); if (!raw) return "0.00";
  let normalized = raw.replace(/\s/g, "").replace(/^R\$/i, "");
  if (normalized.includes(",") && normalized.includes(".")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (normalized.includes(",")) normalized = normalized.replace(",", ".");
  const n = Number(normalized); return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : "";
}
function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); if (!lines.length) return [];
  const delimiter = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const parseLine = (line: string) => {
    const cells: string[] = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) { const c = line[i], next = line[i+1];
      if (c === '"' && quoted && next === '"') { current += '"'; i++; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (c === delimiter && !quoted) { cells.push(current.trim()); current = ""; continue; }
      current += c;
    }
    cells.push(current.trim()); return cells;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => parseLine(line).reduce<Record<string, string>>((acc, cell, i) => ({ ...acc, [headers[i] || `col${i}`]: cell }), {}));
}
function mapRecord(record: Record<string, unknown>): ImportRow {
  const r = Object.fromEntries(Object.entries(record).map(([k,v]) => [cleanKey(k), String(v ?? "").trim()]));
  const get = (...keys: string[]) => keys.map(k => r[cleanKey(k)]).find(Boolean) || "";
  const taxKey = cleanKey(get("regime", "regime tributario", "regime tributário"));
  return {
    name: get("nome", "cliente", "razao social", "razão social", "name"),
    cpfCnpj: get("cpf/cnpj", "cpfcnpj", "documento", "cnpj", "cpf"),
    phone: get("telefone", "celular", "whatsapp", "phone"),
    email: get("email", "e-mail"),
    address: get("endereco", "endereço", "address"),
    monthlyFee: money(get("honorario", "honorário", "valor honorario", "valor do honorario", "valor do honorário", "valor")),
    notes: get("observacoes", "observações", "obs", "notes"),
    taxRegime: taxAliases[taxKey] || "simples_nacional",
  };
}
export function ClientImportDialog({ companyId, clients, onImported }: { companyId?: number | null; clients: Array<{ cpfCnpj?: string | null; phone?: string | null }>; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false); const [fileName, setFileName] = useState(""); const [rows, setRows] = useState<PreviewRow[]>([]); const [report, setReport] = useState<any>(null);
  const existingDocs = useMemo(() => new Set(clients.map(c => onlyDigits(c.cpfCnpj)).filter(Boolean)), [clients]);
  const existingPhones = useMemo(() => new Set(clients.map(c => onlyDigits(c.phone)).filter(Boolean)), [clients]);
  const mutation = trpc.clients.importBatch.useMutation({ onSuccess: data => { setReport(data); toast.success(`${data.imported} cliente(s) importado(s).`); onImported(); }, onError: e => toast.error(`Erro ao importar: ${e.message}`) });
  const preview = (records: Record<string, unknown>[]) => {
    const seenDocs = new Set<string>(); const seenPhones = new Set<string>();
    return records.map((record, index) => { const data = mapRecord(record); const errors: string[] = []; const doc = onlyDigits(data.cpfCnpj); const phone = onlyDigits(data.phone);
      if (!data.name) errors.push("Nome não informado."); if (!doc || doc.length < 11) errors.push("CPF/CNPJ inválido."); if (data.monthlyFee === "") errors.push("Valor inválido.");
      const duplicate = Boolean((doc && (existingDocs.has(doc) || seenDocs.has(doc))) || (phone && (existingPhones.has(phone) || seenPhones.has(phone))));
      if (doc) seenDocs.add(doc); if (phone) seenPhones.add(phone); return { rowNumber: index + 2, data, errors, duplicate };
    });
  };
  const handleFile = async (file?: File | null) => { if (!file) return; setFileName(file.name); setReport(null);
    try { let records: Record<string, unknown>[] = []; const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv")) records = parseCsv(await file.text());
      else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) { const XLSX = await import("xlsx"); const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); records = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" }); }
      else throw new Error("Envie um arquivo CSV, XLSX ou XLS.");
      setRows(preview(records));
    } catch(e) { toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); setRows([]); }
  };
  const validRows = rows.filter(r => !r.errors.length).map(r => r.data);
  const close = (next: boolean) => { setOpen(next); if (!next) { setRows([]); setFileName(""); setReport(null); if (fileRef.current) fileRef.current.value = ""; } };
  return <Dialog open={open} onOpenChange={close}><DialogTrigger asChild><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Importar clientes</Button></DialogTrigger>
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[920px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Importar clientes</DialogTitle><DialogDescription>Envie CSV, XLSX ou XLS e revise os dados antes de confirmar.</DialogDescription></DialogHeader>
      <Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFile(e.target.files?.[0])} />
      {fileName ? <div className="text-sm text-muted-foreground">Arquivo: <Badge variant="secondary">{fileName}</Badge></div> : null}
      {rows.length ? <div className="overflow-x-auto rounded-2xl border"><table className="min-w-[860px] w-full text-sm"><thead className="bg-muted/60"><tr><th className="px-3 py-2 text-left">Linha</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-left">CPF/CNPJ</th><th className="px-3 py-2 text-left">Telefone</th><th className="px-3 py-2 text-left">Honorário</th><th className="px-3 py-2 text-left">Situação</th></tr></thead><tbody>{rows.slice(0,12).map(row => <tr key={row.rowNumber} className="border-t"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.data.name || "—"}</td><td className="px-3 py-2">{row.data.cpfCnpj || "—"}</td><td className="px-3 py-2">{row.data.phone || "—"}</td><td className="px-3 py-2">{row.data.monthlyFee || "0.00"}</td><td className="px-3 py-2">{row.errors.length ? <span className="inline-flex items-center gap-1 text-red-700"><TriangleAlert className="h-4 w-4" />{row.errors[0]}</span> : row.duplicate ? <span className="inline-flex items-center gap-1 text-amber-700"><TriangleAlert className="h-4 w-4" />Possível duplicidade</span> : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Pronta</span>}</td></tr>)}</tbody></table></div> : null}
      {report ? <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 text-sm"><p className="font-semibold">Relatório da importação</p><p>Recebidas: {report.totalReceived} · Importadas: {report.imported} · Duplicadas: {report.duplicates} · Erros: {report.errorCount}</p></div> : null}
      <DialogFooter><Button variant="outline" onClick={() => close(false)}>Fechar</Button><Button disabled={!validRows.length || mutation.isPending} onClick={() => companyId ? mutation.mutate({ companyId, rows: validRows }) : toast.error("Cadastre a empresa antes de importar clientes.")}>{mutation.isPending ? "Importando..." : "Confirmar importação"}</Button></DialogFooter>
    </DialogContent></Dialog>;
}
