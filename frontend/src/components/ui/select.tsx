import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, disabled, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "w-full h-10 px-3.5 pr-10 py-2 text-sm font-sans bg-white text-slate-900 border rounded-xl appearance-none cursor-pointer transition-colors duration-150 ease-clinical",
            "focus-visible:outline-2 focus-visible:outline-teal-600",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
            error ? "border-rose-500 bg-rose-50/20 text-rose-950" : "border-slate-300 hover:border-slate-400",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    );
  }
);
Select.displayName = "Select";
