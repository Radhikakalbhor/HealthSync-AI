import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetContextValue {
  open: boolean;
  setOpen: (val: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isOpen = onOpenChange ? open : internalOpen;

  const setOpen = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    else setInternalOpen(val);
  };

  return <SheetContext.Provider value={{ open: isOpen, setOpen }}>{children}</SheetContext.Provider>;
};

export const SheetTrigger: React.FC<{ children: React.ReactElement<any> }> = ({ children }) => {
  const ctx = React.useContext(SheetContext);
  return React.cloneElement(children, {
    onClick: (e: any) => {
      children.props?.onClick?.(e);
      ctx?.setOpen(true);
    },
  });
};

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "right" | "left" | "top" | "bottom";
}

export const SheetContent: React.FC<SheetContentProps> = ({ side = "right", className, children, ...props }) => {
  const ctx = React.useContext(SheetContext);
  if (!ctx?.open) return null;

  const sideClasses = {
    right: "right-0 top-0 bottom-0 w-full max-w-md animate-in slide-in-from-right duration-240",
    left: "left-0 top-0 bottom-0 w-full max-w-md animate-in slide-in-from-left duration-240",
    top: "top-0 left-0 right-0 max-h-96 animate-in slide-in-from-top duration-240",
    bottom: "bottom-0 left-0 right-0 max-h-96 animate-in slide-in-from-bottom duration-240",
  }[side];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex">
      <div className="fixed inset-0" onClick={() => ctx.setOpen(false)} />
      <div
        className={cn(
          "fixed bg-white shadow-2xl p-6 overflow-y-auto border-l border-slate-200 z-50",
          sideClasses,
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

export const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("space-y-1.5 text-left mb-6", className)} {...props} />
);

export const SheetTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h2 className={cn("text-lg font-bold font-display text-slate-950 tracking-tight", className)} {...props} />
);

export const SheetDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={cn("text-xs text-slate-500 font-sans leading-relaxed", className)} {...props} />
);
