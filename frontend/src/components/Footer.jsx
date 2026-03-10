import React from "react";
import { Link } from "react-router-dom";
import { Twitter, MessageCircle, Github, ChevronRight, Brain, Scale, Link2, FileText, Hexagon } from "lucide-react";

export default function Footer() {
  const platformLinks = [
    { label: 'AI Research', to: '/research', icon: Brain },
    { label: 'Compare Articles', to: '/compare', icon: Scale },
    { label: 'Curate & Publish', to: '/legacy', icon: Link2 },
    { label: 'Browse Articles', to: '/curated', icon: FileText },
  ];

  const resourceLinks = [
    { label: 'Documentation', href: '#' },
    { label: 'FAQ', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
  ];

  const networkLinks = [
    { label: 'Arbitrum Status', href: '#' },
    { label: 'Smart Contract', href: '#' },
    { label: 'Governance', href: '#' },
    { label: 'Token Info', href: '#' },
  ];

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800/50 mt-auto relative z-10">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3 mb-6 group">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 group-hover:border-emerald-500/50 transition-all duration-300 overflow-hidden">
                <img src="/logo.png" alt="Wrap-Up Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Wrap<span className="text-emerald-400">-Up</span>
              </span>
            </Link>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6 max-w-sm">
              The decentralized AI-powered curation layer for Web3. Research, compare, and verify news with transparency built on Arbitrum.
            </p>
            <div className="flex gap-3">
              {[
                { Icon: Twitter, href: '#', label: 'Twitter' },
                { Icon: MessageCircle, href: '#', label: 'Discord' },
                { Icon: Github, href: '#', label: 'GitHub' },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-300"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-white font-bold mb-5 text-xs uppercase tracking-wider">Platform</h3>
            <ul className="space-y-3">
              {platformLinks.map(({ label, to, icon: Icon }) => (
                <li key={label}>
                  <Link 
                    to={to} 
                    className="text-zinc-500 hover:text-emerald-400 transition-colors text-sm flex items-center gap-2 group"
                  >
                    <Icon className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h3 className="text-white font-bold mb-5 text-xs uppercase tracking-wider">Resources</h3>
            <ul className="space-y-3">
              {resourceLinks.map(({ label, href }) => (
                <li key={label}>
                  <a 
                    href={href} 
                    className="text-zinc-500 hover:text-emerald-400 transition-colors text-sm flex items-center gap-2 group"
                  >
                    <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-emerald-400 transition-colors" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Network Links */}
          <div>
            <h3 className="text-white font-bold mb-5 text-xs uppercase tracking-wider">Network</h3>
            <ul className="space-y-3">
              {networkLinks.map(({ label, href }) => (
                <li key={label}>
                  <a 
                    href={href} 
                    className="text-zinc-500 hover:text-emerald-400 transition-colors text-sm flex items-center gap-2 group"
                  >
                    <Hexagon className="w-3 h-3 text-zinc-700 group-hover:text-emerald-400 transition-colors" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-600 text-xs font-medium">
            © {new Date().getFullYear()} Wrap-Up Protocol. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-zinc-400 text-xs font-mono">Arbitrum Testnet</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
