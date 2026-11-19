import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, leftIcon, rightIcon, disabled, id, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          id={id}
          ref={ref}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={cn(
            "w-full h-10 px-3.5 py-2 text-sm font-sans bg-white text-slate-900 border rounded-xl placeholder:text-slate-400 transition-colors duration-150 ease-clinical",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed",
            error
              ? "border-rose-500 focus-visible:outline-rose-500 bg-rose-50/20 text-rose-950"
              : "border-slate-300 hover:border-slate-400",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
