"use client";
import React from "react";
import { cn } from "@/lib/utils";

export const BackgroundBeams: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none overflow-hidden opacity-40 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]",
        className
      )}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full text-teal-600/10"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="beam-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="500" cy="500" r="400" fill="url(#beam-grad)" />
      </svg>
    </div>
  );
};
