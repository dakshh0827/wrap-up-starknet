import React from "react";

const variants = {
  default: "bg-zinc-900/50 border-zinc-800",
  elevated: "bg-zinc-900 border-zinc-800 shadow-xl shadow-black/20",
  glass: "bg-zinc-900/30 backdrop-blur-xl border-zinc-800/50",
  interactive: "bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 cursor-pointer transition-all duration-300 hover:-translate-y-1",
  outline: "bg-transparent border-zinc-800 hover:border-zinc-700",
  success: "bg-emerald-500/5 border-emerald-500/30",
};

export default function Card({
  children,
  variant = "default",
  padding = "md",
  className = "",
  header,
  footer,
  ...props
}) {
  const paddingSizes = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`rounded-2xl border ${variants[variant]} ${className}`}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 rounded-t-2xl">
          {header}
        </div>
      )}
      <div className={paddingSizes[padding]}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl">
          {footer}
        </div>
      )}
    </div>
  );
}

export function CardTitle({ children, className = "" }) {
  return (
    <h3 className={`text-lg font-bold text-white ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "" }) {
  return (
    <p className={`text-sm text-zinc-400 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}
