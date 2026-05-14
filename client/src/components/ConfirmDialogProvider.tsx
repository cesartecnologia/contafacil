import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

type ConfirmDialogState = Required<ConfirmOptions> & {
  open: boolean;
};

const initialState: ConfirmDialogState = {
  open: false,
  title: "Confirmar ação",
  description: "Tem certeza que deseja continuar?",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  variant: "default",
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>(initialState);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeWith = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState(prev => ({ ...prev, open: false }));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options.title ?? initialState.title,
        description: options.description ?? initialState.description,
        confirmText: options.confirmText ?? initialState.confirmText,
        cancelText: options.cancelText ?? initialState.cancelText,
        variant: options.variant ?? initialState.variant,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Dialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) closeWith(false);
        }}
      >
        <DialogContent className="sm:max-w-[460px] border-red-100/80 bg-white/95 backdrop-blur-xl">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-semibold text-zinc-900">{state.title}</DialogTitle>
                <DialogDescription className="text-sm leading-6 text-zinc-600">
                  {state.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-w-[120px]" onClick={() => closeWith(false)}>
              {state.cancelText}
            </Button>
            <Button
              type="button"
              variant={state.variant === "destructive" ? "destructive" : "default"}
              className="min-w-[120px]"
              onClick={() => closeWith(true)}
            >
              {state.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog deve ser usado dentro de ConfirmDialogProvider");
  }
  return context;
}
