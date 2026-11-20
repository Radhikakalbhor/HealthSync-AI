"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import Link from "next/link";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <>
      <motion.div
        className={cn(
          "h-full px-4 py-4 hidden md:flex md:flex-col bg-[#071727] text-slate-100 border-r border-[#0e2a44] shadow-2xl w-[260px] shrink-0",
          className
        )}
        animate={{
          width: animate ? (open ? "260px" : "72px") : "260px",
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        {children}
      </motion.div>
    </>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-12 px-4 py-2 flex flex-row md:hidden items-center justify-between bg-[#071727] border-b border-[#0e2a44] w-full sticky top-0 z-40 text-white"
        )}
        {...props}
      >
        <div className="flex justify-between items-center z-20 w-full">
          <span className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            HealthSync<span className="text-teal-400">.AI</span>
          </span>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-[#0e2a44]"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <IconMenu2 className="w-5 h-5 text-slate-200" />
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.25,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-[#071727] p-6 z-[100] flex flex-col justify-between overflow-y-auto text-slate-100",
                className
              )}
            >
              <div
                className="absolute right-6 top-6 z-50 text-slate-300 p-2 cursor-pointer hover:bg-[#0e2a44] rounded-lg"
                onClick={() => setOpen(!open)}
              >
                <IconX className="w-5 h-5" />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  isActive = false,
  onClick,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={link.href}
      onClick={onClick}
      className={cn(
        "flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 group/sidebar transition-all cursor-pointer relative",
        isActive
          ? "bg-gradient-to-r from-teal-500/25 to-teal-400/10 text-teal-300 font-bold border-l-4 border-teal-400 shadow-sm"
          : "text-slate-300 hover:text-white hover:bg-white/5 font-medium",
        className
      )}
      {...props}
    >
      <div className={cn("shrink-0 transition-colors", isActive ? "text-teal-300" : "text-slate-400 group-hover/sidebar:text-teal-300")}>
        {link.icon}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className={cn(
          "text-sm whitespace-pre inline-block !p-0 !m-0 transition duration-150 truncate",
          isActive ? "text-teal-300 font-bold" : "text-slate-300 group-hover/sidebar:text-white"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
