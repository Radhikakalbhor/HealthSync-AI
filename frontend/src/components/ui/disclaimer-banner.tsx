import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisclaimerBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ compact = false, className, ...props }) => {
  return (
    <div
      role="note"
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-slate-50/80 p-3.5 sm:p-4 text-slate-600 font-sans flex items-start gap-3",
        compact ? "text-[11px] py-2.5 px-3" : "text-xs",
        className
      )}
      {...props}
    >
      <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="leading-relaxed">
        <strong className="text-slate-800 font-semibold font-display">Medical Notice: </strong>
        HealthSync AI organizes, retrieves, and explains information from your existing medical records. It never diagnoses diseases, recommends clinical treatments, or prescribes medications. Always consult a licensed healthcare professional for clinical decisions.
      </div>
    </div>
  );
};
