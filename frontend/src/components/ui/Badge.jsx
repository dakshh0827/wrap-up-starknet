import React from "react";

const variants = {
  default: "bg-zinc-800 text-zinc-300 border-zinc-700",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/10 text-red-400 border-red-500/30",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export default function Badge({
  children,
  variant = "default",
  icon: Icon,
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider ${variants[variant]} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}
