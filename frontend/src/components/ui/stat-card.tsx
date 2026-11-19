import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl bg-white border border-slate-200/90 shadow-card flex flex-col justify-between transition-shadow hover:shadow-card-hover duration-200",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
          {title}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-display tabular-nums tracking-tight">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs font-sans">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-bold tabular-nums",
                  trend.isPositive
                    ? "text-emerald-700"
                    : trend.direction === "neutral"
                    ? "text-slate-600"
                    : "text-rose-700"
                )}
              >
                {trend.direction === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                {trend.direction === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                {trend.direction === "neutral" && <Minus className="w-3.5 h-3.5" />}
                {trend.value}
              </span>
            )}
            {subtitle && <span className="text-slate-500">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
