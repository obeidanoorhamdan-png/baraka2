import { ReactNode, createContext, useCallback, useContext, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Trash2, KeyRound } from "lucide-react";

type Variant = "default" | "danger" | "success" | "warning";

type Options = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  icon?: ReactNode;
};

type Resolver = (value: boolean) => void;

const ConfirmCtx = createContext<(opts: Options) => Promise<boolean>>(
  () => Promise.resolve(false),
);

export const useConfirm = () => useContext(ConfirmCtx);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Options | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const confirm = useCallback((options: Options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const close = (value: boolean) => {
    setOpen(false);
    resolver?.(value);
    setResolver(null);
  };

  const variant: Variant = opts?.variant ?? "default";
  const accentClass =
    variant === "danger"
      ? "text-destructive bg-destructive/10 ring-destructive/30"
      : variant === "warning"
        ? "text-warning-foreground bg-warning/15 ring-warning/30"
        : variant === "success"
          ? "text-success bg-success/10 ring-success/30"
          : "text-primary bg-accent-soft ring-accent/30";

  const Icon =
    opts?.icon ??
    (variant === "danger" ? <Trash2 className="h-5 w-5" /> :
     variant === "warning" ? <AlertTriangle className="h-5 w-5" /> :
     variant === "success" ? <CheckCircle2 className="h-5 w-5" /> :
     <KeyRound className="h-5 w-5" />);

  const confirmBtnClass =
    variant === "danger"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : variant === "warning"
        ? "bg-warning text-warning-foreground hover:bg-warning/90"
        : "brand-gradient text-primary-foreground";

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className={`mx-auto h-12 w-12 rounded-full ring-2 grid place-items-center ${accentClass}`}>
              {Icon}
            </div>
            <AlertDialogTitle className="text-center">
              {opts?.title}
            </AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription className="text-center whitespace-pre-line">
                {opts.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel onClick={() => close(false)}>
              {opts?.cancelText ?? t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => close(true)} className={confirmBtnClass}>
              {opts?.confirmText ?? t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
};
