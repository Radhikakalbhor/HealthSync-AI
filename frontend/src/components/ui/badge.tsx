import * as React from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "destructive"
    | "critical"
    | "danger"
    | "info"
    | "teal"
    | "purple"
    | "pending"
    | "verified"
    | "high"
    | "normal";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}) => {
  const variantStyles: Record<string, string> = {
    default: "bg-slate-100 text-slate-800 border-slate-200",
    secondary: "bg-teal-50 text-teal-800 border-teal-200/80",
    teal: "bg-teal-50 text-teal-800 border-teal-200/80",
    outline: "bg-transparent text-slate-700 border-slate-300",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    verified: "bg-emerald-50 text-emerald-800 border-emerald-200",
    normal: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    high: "bg-amber-50 text-amber-800 border-amber-200",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    destructive: "bg-rose-50 text-rose-800 border-rose-200",
    critical: "bg-rose-50 text-rose-800 border-rose-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    purple: "bg-purple-50 text-purple-800 border-purple-200",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] tracking-wider uppercase font-bold",
    md: "px-2.5 py-1 text-xs font-semibold",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-sans select-none leading-none",
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "optimal" | "normal" | "warning" | "high" | "critical" | "info";
  label?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  className,
  ...props
}) => {
  const config = {
    optimal: {
      bg: "bg-emerald-50 border-emerald-200/90 text-emerald-800",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "Optimal",
    },
    normal: {
      bg: "bg-emerald-50 border-emerald-200/90 text-emerald-800",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "Normal",
    },
    warning: {
      bg: "bg-amber-50 border-amber-200/90 text-amber-800",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "Elevated",
    },
    high: {
      bg: "bg-amber-50 border-amber-200/90 text-amber-800",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "High",
    },
    critical: {
      bg: "bg-rose-50 border-rose-200/90 text-rose-800",
      icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "Critical",
    },
    info: {
      bg: "bg-sky-50 border-sky-200/90 text-sky-800",
      icon: <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" aria-hidden="true" />,
      defaultLabel: "Information",
    },
  }[status] || {
    bg: "bg-slate-100 border-slate-200 text-slate-800",
    icon: <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />,
    defaultLabel: "Standard",
  };

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <div
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-sans font-semibold leading-none select-none",
        config.bg,
        sizeClasses,
        className
      )}
      {...props}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </div>
  );
};
