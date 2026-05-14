import { useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const slots = Array.from({ length: 19 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
});

function addThirtyMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + 30;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

type AppointmentDraft = {
  title: string;
  clientName: string;
  clientPhone: string;
  notes: string;
  date: string;
  startTime: string;
};

const emptyDraft: AppointmentDraft = {
  title: "",
  clientName: "",
  clientPhone: "",
  notes: "",
  date: "",
  startTime: "08:00",
};

export default function Agenda() {
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [draft, setDraft] = useState<AppointmentDraft>(emptyDraft);

  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const from = format(weekDays[0], "yyyy-MM-dd");
  const to = format(weekDays[6], "yyyy-MM-dd");

  const { data: appointments = [], isLoading, refetch } = trpc.appointments.listByRange.useQuery({ from, to });

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso.");
      setDialogOpen(false);
      setDraft(emptyDraft);
      refetch();
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento remarcado com sucesso.");
      setIsRescheduling(false);
      setDialogOpen(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: error => toast.error(error.message),
  });
  const cancelMutation = trpc.appointments.cancel.useMutation({
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      setDialogOpen(false);
      setSelectedAppointment(null);
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const openNew = (day: Date, startTime: string) => {
    setSelectedAppointment(null);
    setIsRescheduling(false);
    setDraft({
      ...emptyDraft,
      date: format(day, "yyyy-MM-dd"),
      startTime,
    });
    setDialogOpen(true);
  };

  const openExisting = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsRescheduling(false);
    setDraft({
      title: appointment.title || "",
      clientName: appointment.clientName || "",
      clientPhone: appointment.clientPhone || "",
      notes: appointment.notes || "",
      date: appointment.date,
      startTime: appointment.startTime,
    });
    setDialogOpen(true);
  };

  const scheduledAt = (day: Date, startTime: string) => appointments.find(item =>
    item.status === "scheduled" &&
    item.date === format(day, "yyyy-MM-dd") &&
    item.startTime === startTime
  );

  const saveNewAppointment = () => {
    if (!draft.title.trim()) {
      toast.error("Informe o título do agendamento.");
      return;
    }
    createMutation.mutate({
      title: draft.title.trim(),
      clientName: draft.clientName.trim() || undefined,
      clientPhone: draft.clientPhone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      date: draft.date,
      startTime: draft.startTime,
      endTime: addThirtyMinutes(draft.startTime),
    });
  };

  const saveReschedule = () => {
    if (!selectedAppointment) return;
    if (!draft.title.trim()) {
      toast.error("Informe o título do agendamento.");
      return;
    }
    updateMutation.mutate({
      id: selectedAppointment.id,
      title: draft.title.trim(),
      clientName: draft.clientName.trim() || undefined,
      clientPhone: draft.clientPhone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      date: draft.date,
      startTime: draft.startTime,
      endTime: addThirtyMinutes(draft.startTime),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agenda</h1>
          <p className="mt-1 text-muted-foreground">Organize seus compromissos e acompanhe sua semana com facilidade.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekAnchor(value => subWeeks(value, 1))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] flex-1 rounded-xl border bg-white/50 px-4 py-2 text-center text-sm font-semibold backdrop-blur sm:flex-none">
            {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekAnchor(value => addWeeks(value, 1))} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setWeekAnchor(new Date())}>Hoje</Button>
        </div>
      </div>

      <Card className="overflow-hidden border-white/20 bg-white/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Grade semanal</CardTitle>
          <CardDescription>Clique em um horário para criar ou consultar um compromisso.</CardDescription>
          <p className="text-xs text-muted-foreground md:hidden">Deslize horizontalmente para visualizar toda a semana.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[90px_repeat(7,minmax(140px,1fr))] border-b bg-white/45">
                <div className="p-3 text-sm font-semibold text-muted-foreground">Horário</div>
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="border-l p-3 text-center">
                    <p className="text-sm font-semibold capitalize">{format(day, "EEEE", { locale: ptBR })}</p>
                    <p className="text-xs text-muted-foreground">{format(day, "dd/MM")}</p>
                  </div>
                ))}
              </div>
              {slots.map(slot => (
                <div key={slot} className="grid min-h-[78px] grid-cols-[90px_repeat(7,minmax(140px,1fr))] border-b last:border-b-0">
                  <div className="flex items-start gap-1 p-3 text-sm font-semibold text-muted-foreground">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5" />
                    {slot}
                  </div>
                  {weekDays.map(day => {
                    const appointment = scheduledAt(day, slot);
                    return (
                      <button
                        type="button"
                        key={`${format(day, "yyyy-MM-dd")}-${slot}`}
                        className="group border-l p-2 text-left transition-colors hover:bg-primary/5"
                        onClick={() => appointment ? openExisting(appointment) : openNew(day, slot)}
                      >
                        {appointment ? (
                          <div className="h-full rounded-2xl border border-primary/25 bg-primary/10 p-3 shadow-sm transition-transform group-hover:-translate-y-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-semibold text-primary">{appointment.title}</p>
                              <Badge variant="secondary" className="shrink-0 text-[10px]">{appointment.startTime}</Badge>
                            </div>
                            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{appointment.clientName || "Sem cliente informado"}</p>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                            <Plus className="mr-1 h-3.5 w-3.5" /> Agendar
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {isLoading ? <div className="border-t p-4 text-sm text-muted-foreground">Carregando agenda...</div> : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={open => {
        setDialogOpen(open);
        if (!open) {
          setSelectedAppointment(null);
          setIsRescheduling(false);
          setDraft(emptyDraft);
        }
      }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAppointment
                ? isRescheduling ? "Remarcar agendamento" : "Detalhes do agendamento"
                : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              {selectedAppointment && !isRescheduling
                ? "Cancele ou remarque este compromisso."
                : "O horário será reservado em blocos de 30 minutos."}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && !isRescheduling ? (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-muted/35 p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Compromisso</p>
                    <p className="text-lg font-bold">{selectedAppointment.title}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                      <p className="font-medium">{new Date(`${selectedAppointment.date}T12:00:00`).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário</p>
                      <p className="font-medium">{selectedAppointment.startTime} às {selectedAppointment.endTime}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><UserRound className="h-3 w-3" /> Cliente</p>
                      <p className="font-medium">{selectedAppointment.clientName || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
                      <p className="font-medium">{selectedAppointment.clientPhone || "Não informado"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
                    <p className="font-medium">{selectedAppointment.notes || "Sem observações"}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="gap-2" onClick={() => setIsRescheduling(true)}>
                  <Pencil className="h-4 w-4" />
                  Remarcar
                </Button>
                <Button variant="destructive" className="gap-2" onClick={() => cancelMutation.mutate(selectedAppointment.id)} disabled={cancelMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="appointment-title">Título *</Label>
                <Input id="appointment-title" value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} placeholder="Reunião, entrega de documento..." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="appointment-client">Cliente</Label>
                  <Input id="appointment-client" value={draft.clientName} onChange={event => setDraft(value => ({ ...value, clientName: event.target.value }))} placeholder="Nome do cliente" />
                </div>
                <div>
                  <Label htmlFor="appointment-phone">Telefone</Label>
                  <Input id="appointment-phone" value={draft.clientPhone} onChange={event => setDraft(value => ({ ...value, clientPhone: event.target.value }))} placeholder="(33) 99999-9999" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="appointment-date">Data</Label>
                  <Input id="appointment-date" type="date" value={draft.date} onChange={event => setDraft(value => ({ ...value, date: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="appointment-time">Horário</Label>
                  <select
                    id="appointment-time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={draft.startTime}
                    onChange={event => setDraft(value => ({ ...value, startTime: event.target.value }))}
                  >
                    {slots.map(slot => <option key={slot} value={slot}>{slot} - {addThirtyMinutes(slot)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="appointment-notes">Observações</Label>
                <Textarea id="appointment-notes" value={draft.notes} onChange={event => setDraft(value => ({ ...value, notes: event.target.value }))} placeholder="Detalhes do atendimento..." />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Fechar</Button>
                <Button onClick={selectedAppointment ? saveReschedule : saveNewAppointment} disabled={createMutation.isPending || updateMutation.isPending}>
                  {selectedAppointment ? "Salvar remarcação" : "Criar agendamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
