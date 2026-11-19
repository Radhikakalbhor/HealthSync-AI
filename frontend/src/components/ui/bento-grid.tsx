import * as React from "react";
import { cn } from "@/lib/utils";

export const BentoGrid: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className, children }) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem: React.FC<{
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ className, title, description, header, icon }) => {
  return (
    <div
      className={cn(
        "row-span-1 rounded-3xl group/bento hover:shadow-xl transition duration-200 shadow-input p-6 bg-white border border-slate-200/90 justify-between flex flex-col space-y-4",
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        {icon}
        <div className="font-bold text-slate-900 font-display mb-1 mt-2 text-base">
          {title}
        </div>
        <div className="font-normal text-slate-500 text-xs leading-relaxed font-sans">
          {description}
        </div>
      </div>
    </div>
  );
};
