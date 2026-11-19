import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onChange, onCheckedChange, disabled, id, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label className="relative inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            "w-5 h-5 rounded-md border border-slate-300 bg-white flex items-center justify-center transition-all duration-150",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-teal-600",
            "peer-checked:bg-teal-600 peer-checked:border-teal-600 peer-checked:text-white",
            "peer-disabled:bg-slate-100 peer-disabled:border-slate-200 peer-disabled:cursor-not-allowed",
            className
          )}
        >
          {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
