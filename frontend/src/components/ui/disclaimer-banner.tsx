"use client";
import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { StickyBanner } from "@/components/ui/sticky-banner";
import { cn } from "@/lib/utils";

export interface DisclaimerBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ compact = false, className }) => {
  return (
    <StickyBanner
      className={cn(
        "rounded-2xl bg-gradient-to-r from-health-900 via-teal-900 to-navy-950 text-white shadow-md border border-teal-500/30 p-3.5 sm:p-4 text-xs font-sans my-4",
        compact && "text-[11px] py-2.5 px-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5 max-w-4xl mx-auto pr-6 text-white">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed drop-shadow-sm text-slate-100">
          <strong className="text-amber-300 font-semibold font-display">Medical Notice: </strong>
          HealthSync AI organizes, retrieves, and explains information from your existing medical records. It never diagnoses diseases, recommends clinical treatments, or prescribes medications. Always consult a licensed healthcare professional for clinical decisions.
        </p>
      </div>
    </StickyBanner>
  );
};
