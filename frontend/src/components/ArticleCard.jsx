import React, { useMemo, useEffect } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { CONTRACT_ADDRESSES } from "../wagmiConfig";
import toast from "react-hot-toast";

export default function ArticleCard({ article }) {
  const { isConnected } = useAccount();

  // 1. Prepare Starknet Transaction
  const calls = useMemo(() => {
    if (!article?.id) return [];
    return [{
      contractAddress: CONTRACT_ADDRESSES.devnet,
      entrypoint: "upvoteArticle",
      calldata: [article.id]
    }];
  }, [article?.id]);

  // 2. The New Hook (Replaces Wagmi's useWriteContract)
  const { sendAsync: upvoteArticle, isPending } = useSendTransaction({ calls });

  const handleUpvote = async (e) => {
    e.preventDefault();
    if (!isConnected) return toast.error("Connect Starknet wallet first!");
    
    toast.loading("Confirm in wallet...", { id: `upvote-${article.id}` });
    try {
      await upvoteArticle();
      toast.success("Upvote Successful!", { id: `upvote-${article.id}` });
    } catch (err) {
      toast.error("Transaction rejected", { id: `upvote-${article.id}` });
    }
  };

  return (
    <div className="group relative flex flex-col h-full bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden hover:border-[#10b981] transition-all duration-300 ease-out hover:-translate-y-1">
      {/* Image Container */}
      <div className="relative h-52 overflow-hidden bg-[#18181b]">
        <img 
          src={article.urlToImage || "/fallback.jpg"} 
          alt={article.title} 
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 grayscale group-hover:grayscale-0" 
        />
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm border border-[#27272a] px-3 py-1 rounded-md">
           <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">News</span>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow">
        <h2 className="font-semibold text-lg mb-3 text-white leading-tight group-hover:text-[#10b981] transition-colors line-clamp-2">
          {article.title}
        </h2>
        <p className="text-sm text-zinc-400 mb-6 line-clamp-3 leading-relaxed flex-grow">
          {article.description}
        </p>
        
        <div className="pt-4 border-t border-[#27272a] flex items-center justify-between mt-auto">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wide hover:text-[#10b981] transition-colors group/link"
          >
            <span>Read Original</span>
            <svg className="w-3 h-3 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>

          {/* ADDED STARKNET UPVOTE BUTTON INTEGRATED INTO YOUR EXACT UI */}
          <button 
            onClick={handleUpvote}
            disabled={isPending}
            className="text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-[#10b981] transition-colors disabled:opacity-50"
          >
            {isPending ? "Confirming..." : `Upvote (${article.upvotes || 0})`}
          </button>
        </div>
      </div>
    </div>
  );
}