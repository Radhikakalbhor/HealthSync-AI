import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "subtle" | "demo" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, loading = false, disabled, children, ...props }, ref) => {
    const isSpinning = isLoading || loading;
    const baseStyles =
      "inline-flex items-center justify-center font-medium font-sans rounded-xl transition-colors duration-150 ease-clinical focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer";

    const variantStyles: Record<string, string> = {
      primary:
        "bg-teal-600 hover:bg-teal-700 text-white shadow-card hover:shadow-card-hover border border-teal-700/20 active:translate-y-0.5",
      secondary:
        "bg-sky-600 hover:bg-sky-700 text-white shadow-card hover:shadow-card-hover border border-sky-700/20 active:translate-y-0.5",
      outline:
        "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs hover:border-slate-400 active:translate-y-0.5",
      ghost:
        "bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 active:translate-y-0.5",
      destructive:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-card border border-rose-700/20 active:translate-y-0.5",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-card border border-rose-700/20 active:translate-y-0.5",
      subtle:
        "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 active:translate-y-0.5",
      demo:
        "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 font-bold active:translate-y-0.5",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5 min-w-[32px]",
      md: "h-10 px-4 text-sm gap-2 min-h-[40px]",
      lg: "h-12 px-6 text-base gap-2.5 min-h-[48px]",
      icon: "h-10 w-10 p-0 shrink-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isSpinning}
        aria-busy={isSpinning}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isSpinning && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
