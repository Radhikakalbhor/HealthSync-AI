import * as React from "react";
import { CheckCircle2, AlertOctagon, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id?: string;
  type?: "success" | "error" | "info";
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = "info",
  title,
  description,
  onClose,
  className,
}) => {
  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    error: <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
  }[type];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-modal max-w-sm w-full animate-in slide-in-from-bottom-2 duration-200",
        className
      )}
    >
      {icon}
      <div className="flex-1 space-y-0.5">
        <h4 className="text-sm font-bold text-slate-900 font-display">{title}</h4>
        {description && <p className="text-xs text-slate-500 font-sans">{description}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
