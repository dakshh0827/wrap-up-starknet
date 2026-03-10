import React from "react";
import { ThumbsUp, ArrowRight } from "lucide-react";

export default function InshortCard({ article, onClick }) {
  return (
    <div
      className="group bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden cursor-pointer hover:border-zinc-500 transition-all duration-300 flex flex-col h-full"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden border-b border-[#27272a]">
        <img 
          src={article.imageUrl || "/fallback.jpg"} 
          alt={article.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
        />
        {/* Overlay for text readability if needed, though clean is better */}
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <h2 className="font-bold text-lg mb-3 text-white leading-snug group-hover:underline decoration-[#10b981] underline-offset-4 decoration-2">
          {article.title}
        </h2>
        <p className="text-sm text-zinc-400 mb-5 line-clamp-3 leading-relaxed flex-grow">
          {article.summary}
        </p>
        
        <div className="flex items-center justify-between pt-4 border-t border-[#27272a] mt-auto">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
             <ThumbsUp className="w-4 h-4 text-[#10b981]" />
             <span className="text-white">{article.upvotes}</span>
          </div>
          <button className="text-white hover:text-[#10b981] text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors">
            Read <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}