import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
  open: boolean;
  setOpen: (val: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isOpen = onOpenChange ? open : internalOpen;

  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  };

  return <DialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</DialogContext.Provider>;
};

export const DialogTrigger: React.FC<{ children: React.ReactElement<any>; asChild?: boolean }> = ({ children }) => {
  const ctx = React.useContext(DialogContext);
  return React.cloneElement(children, {
    onClick: (e: any) => {
      children.props?.onClick?.(e);
      ctx?.setOpen(true);
    },
  });
};

export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={cn(
          "relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-modal animate-in zoom-in-95 duration-200",
          className
        )}
        {...props}
      >
        <button
          onClick={() => ctx.setOpen(false)}
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("space-y-1.5 text-left mb-5", className)} {...props} />
);

export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h2 className={cn("text-xl font-bold font-display text-slate-950 tracking-tight", className)} {...props} />
);

export const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn("text-xs text-slate-500 font-sans leading-relaxed", className)} {...props} />
);

export const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100", className)} {...props} />
);
