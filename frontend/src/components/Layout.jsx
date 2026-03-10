import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export function Layout({ children, showFooter = true, className = "" }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Top emerald glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23ffffff' fill='none'/%3E%3C/svg%3E")`
          }}
        />
      </div>
      
      <Navbar />
      
      <main className={`flex-grow relative z-10 ${className}`}>
        {children}
      </main>
      
      {showFooter && <Footer />}
    </div>
  );
}

export function PageHeader({ 
  badge, 
  badgeIcon: BadgeIcon,
  title, 
  highlight, 
  description,
  actions,
  className = "" 
}) {
  return (
    <div className={`text-center ${className}`}>
      {badge && (
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full mb-6">
          {BadgeIcon && <BadgeIcon className="w-3.5 h-3.5 text-emerald-400" />}
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {badge}
          </span>
        </div>
      )}
      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
        {title}{" "}
        {highlight && <span className="text-emerald-400">{highlight}</span>}
      </h1>
      {description && (
        <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {actions && (
        <div className="flex items-center justify-center gap-4 mt-8">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Section({ children, className = "", id }) {
  return (
    <section id={id} className={`py-20 md:py-32 ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {children}
      </div>
    </section>
  );
}

export function SectionHeader({ title, description, className = "" }) {
  return (
    <div className={`text-center mb-16 ${className}`}>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
      {description && (
        <p className="text-zinc-500 text-lg max-w-2xl mx-auto">{description}</p>
      )}
    </div>
  );
}
