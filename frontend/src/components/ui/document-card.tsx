import * as React from "react";
import Link from "next/link";
import { FileText, Calendar, Building, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

export interface DocumentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  title: string;
  category: string;
  date: string;
  doctor?: string;
  facility?: string;
  confidence?: number | null;
  needsReview?: boolean;
  href?: string;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  id,
  title,
  category,
  date,
  doctor,
  facility,
  confidence,
  needsReview,
  href = `/documents/${id}`,
  className,
  ...props
}) => {
  return (
    <Link href={href} className="block group">
      <div
        className={cn(
          "p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs group-hover:shadow-card-hover group-hover:border-teal-300 transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-150">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-950 font-display group-hover:text-teal-700 transition-colors line-clamp-1">
                {title}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-sans">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {date}
                </span>
                {facility && (
                  <span className="inline-flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    {facility}
                  </span>
                )}
                {doctor && (
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {doctor}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <Badge variant="secondary" size="sm">
            {category}
          </Badge>

          {needsReview ? (
            <Badge variant="warning" size="sm">
              Needs Review
            </Badge>
          ) : confidence !== undefined && confidence !== null ? (
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {Math.round(confidence * 100)}% verified
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
};
