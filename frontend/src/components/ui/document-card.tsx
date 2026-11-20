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
  const cat = (category || '').toLowerCase();
  const isPrescription = cat.includes('prescription') || cat.includes('rx');
  const isLab = cat.includes('lab') || cat.includes('blood') || cat.includes('test');
  const isConsultation = cat.includes('consult') || cat.includes('doctor') || cat.includes('note');

  return (
    <Link href={href} className="block group">
      <div
        className={cn(
          "p-4 sm:p-5 rounded-2xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 group-hover:shadow-md group-hover:border-[#13B8AE] transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                isPrescription
                  ? "bg-blue-100/90 text-blue-700 border border-blue-200"
                  : isLab
                  ? "bg-purple-100/90 text-purple-700 border border-purple-200"
                  : isConsultation
                  ? "bg-emerald-100/90 text-emerald-700 border border-emerald-200"
                  : "bg-teal-100/90 text-teal-700 border border-teal-200"
              )}
            >
              <FileText className="w-5 h-5 stroke-[2.2]" />
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

        <div className="flex items-center justify-between pt-2 border-t border-sky-100 text-xs">
          <Badge
            variant={isPrescription ? "secondary" : isLab ? "default" : "secondary"}
            size="sm"
            className={cn(
              isPrescription
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : isLab
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : isConsultation
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-teal-50 text-teal-700 border-teal-200"
            )}
          >
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
