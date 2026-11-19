import * as React from "react";
import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "p-8 sm:p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center max-w-lg mx-auto",
        className
      )}
      {...props}
    >
      <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-4 shadow-2xs">
        {icon || <FileQuestion className="w-7 h-7 text-teal-600" />}
      </div>
      <h3 className="text-base sm:text-lg font-bold font-display text-slate-950 tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-sans leading-relaxed max-w-sm">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button onClick={onAction} size="md">
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
