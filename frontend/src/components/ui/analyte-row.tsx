import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./badge";

export interface AnalyteRowProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: "optimal" | "normal" | "warning" | "high" | "critical" | "info";
  statusLabel?: string;
}

export const AnalyteRow: React.FC<AnalyteRowProps> = ({
  name,
  value,
  unit,
  referenceRange,
  status,
  statusLabel,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "py-3 px-4 rounded-xl flex items-center justify-between gap-4 border border-slate-100 hover:bg-slate-50/70 transition-colors duration-150",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        <h5 className="text-sm font-semibold text-slate-900 font-sans truncate">{name}</h5>
        {referenceRange && (
          <p className="text-[11px] text-slate-500 font-sans">
            Reference: <span className="tabular-nums">{referenceRange}</span>
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-slate-950 tabular-nums">
          {value} {unit && <span className="text-xs font-normal text-slate-500">{unit}</span>}
        </div>
      </div>

      <div className="shrink-0">
        <StatusBadge status={status} label={statusLabel} size="sm" />
      </div>
    </div>
  );
};
