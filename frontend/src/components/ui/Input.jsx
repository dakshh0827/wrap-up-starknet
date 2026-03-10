import React from "react";

export default function Input({
  label,
  error,
  icon: Icon,
  className = "",
  containerClassName = "",
  ...props
}) {
  return (
    <div className={containerClassName}>
      {label && (
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          className={`
            w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3.5
            text-white placeholder-zinc-600
            focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? "pl-12" : ""}
            ${error ? "border-red-500/50" : ""}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

export function SearchInput({ className = "", ...props }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-6 pr-6 py-4 text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
        {...props}
      />
    </div>
  );
}
