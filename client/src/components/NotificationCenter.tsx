import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatNotificationDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificationCenter() {
  const utils = trpc.useUtils();
  const { data: notifications = [], isLoading } = trpc.notifications.listByUser.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const unreadCount = notifications.filter(notification => notification.isRead !== "true").length;

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => utils.notifications.listByUser.invalidate(),
    onError: error => toast.error(error.message),
  });

  const remove = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.listByUser.invalidate();
      toast.success("Notificação removida.");
    },
    onError: error => toast.error(error.message),
  });

  const clearAll = trpc.notifications.clearAll.useMutation({
    onSuccess: result => {
      utils.notifications.listByUser.invalidate();
      toast.success(result.removed > 0 ? "Notificações limpas." : "Não há notificações para limpar.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl" aria-label="Abrir notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-[360px] overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">Honorários, agenda e alertas do sistema</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant="secondary">{unreadCount} não lida(s)</Badge>
            {notifications.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => clearAll.mutate()}
                disabled={clearAll.isPending}
              >
                Limpar
              </Button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-3">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Carregando...</p>
          ) : notifications.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 8).map(notification => (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-3 transition-colors ${notification.isRead === "true" ? "bg-background/60" : "bg-primary/5 border-primary/20"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">{notification.title}</p>
                        {notification.isRead !== "true" ? <Badge className="px-1.5 py-0 text-[10px]">Nova</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatNotificationDate(notification.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    {notification.isRead !== "true" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1.5"
                        onClick={() => markAsRead.mutate(notification.id)}
                        disabled={markAsRead.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Marcar lida
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => remove.mutate(notification.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
