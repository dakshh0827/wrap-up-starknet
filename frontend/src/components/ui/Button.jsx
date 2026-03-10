import React from "react";

const variants = {
  primary: "bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40",
  secondary: "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 hover:border-zinc-600",
  outline: "bg-transparent border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500",
  ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white",
  danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = "left",
  className = "",
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold uppercase tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900";

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="w-4 h-4" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="w-4 h-4" />}
        </>
      )}
    </button>
  );
}
