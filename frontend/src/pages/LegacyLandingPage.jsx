import React, { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Section } from "../components/Layout";
import { Button, Card, Badge } from "../components/ui";
import BlockchainBackground from "../components/ui/BlockchainBackground";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useArticleStore } from "../stores/articleStore";
import {
  useAccount,
  useSendTransaction,
  useReadContract   // ✅ NEW
} from "@starknet-react/core";
import { CallData } from "starknet";
import { CONTRACT_ADDRESSES, WRAPUP_ABI } from "../wagmiConfig"; // ✅ added WRAPUP_ABI
import axios from "axios";
import {
  Search, X, Link2, Zap, Save, ArrowRight, ArrowLeft,
  CheckCircle, Circle, Loader
} from "lucide-react";

const API_BASE = "/api";

export default function LegacyLandingPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scrapedPreview, setScrapedPreview] = useState(null);
  const [stepIndex, setStepIndex] = useState(-1);
  const [savedArticle, setSavedArticle] = useState(null);
  const [ipfsHash, setIpfsHash] = useState(null);
  const [txDone, setTxDone] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const navigate = useNavigate();
  const { isConnected, address } = useAccount();
  const { markArticleOnChainDB, deleteArticleFromDB } = useArticleStore();

  const currentContractAddress = CONTRACT_ADDRESSES.devnet;

  const { sendAsync: writeContract } = useSendTransaction({});

  // ✅ FIX: Read current article count so we know which ID will be assigned on-chain
  const { data: articleCountData, refetch: refetchArticleCount } = useReadContract({
    abi: WRAPUP_ABI,
    address: currentContractAddress,
    functionName: 'articleCount',
    args: [],
  });

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url.trim()) { toast.error("Please enter a valid URL"); return; }

    setLoading(true); setError(null); setScrapedPreview(null);
    setSavedArticle(null); setIpfsHash(null); setTxDone(false); setStepIndex(-1);

    const tid = toast.loading("Scraping & summarizing article...");
    try {
      const res = await fetch(`${API_BASE}/articles/scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scraping failed");
      setScrapedPreview(data.preview);
      toast.success("Article analyzed!", { id: tid });
    } catch (err) {
      setError(err.message); toast.error(err.message, { id: tid });
    } finally {
      setLoading(false);
    }
  };

  const handleCurate = async () => {
    if (!scrapedPreview) return;
    if (!isConnected) { toast.error("Connect wallet to curate"); return; }

    setLoading(true); setError(null); setTxDone(false);

    try {
      setStepIndex(0);
      let dbArticle;
      try {
        const res = await axios.post(`${API_BASE}/articles/prepare`, {
          title: scrapedPreview.title, summary: scrapedPreview.summary,
          detailedSummary: scrapedPreview.detailedSummary, condensedContent: scrapedPreview.condensedContent,
          keyPoints: scrapedPreview.keyPoints, statistics: scrapedPreview.statistics,
          imageUrl: scrapedPreview.imageUrl, articleUrl: scrapedPreview.articleUrl,
          cardJson: scrapedPreview.cardJson, author: scrapedPreview.author,
          publisher: scrapedPreview.publisher, date: scrapedPreview.date,
        });
        dbArticle = res.data.article;
        setSavedArticle(dbArticle);
      } catch (err) {
        if (err.response?.data?.article) {
          dbArticle = err.response.data.article; setSavedArticle(dbArticle);
        } else throw new Error(err.response?.data?.error || "DB save failed");
      }

      setStepIndex(1);
      const ipfsRes = await axios.post(`${API_BASE}/articles/upload-ipfs`, { ...scrapedPreview, id: dbArticle.id });
      const generatedHash = ipfsRes.data.ipfsHash;
      if (!generatedHash) throw new Error("IPFS upload failed");

      setIpfsHash(generatedHash);
      setStepIndex(2);

      try {
        setIsPending(true);
        toast.loading("Approve transaction in wallet...", { id: "mintToast" });

        // ✅ FIX: Snapshot current article count BEFORE tx — new ID will be count + 1
        const countResult = await refetchArticleCount();
        const currentCount = countResult?.data ? Number(countResult.data.toString()) : 
                             (articleCountData ? Number(articleCountData.toString()) : 0);
        const expectedOnChainId = currentCount + 1;

        const starknetCalls = [{
          contractAddress: currentContractAddress,
          entrypoint: 'submitArticle',
          calldata: CallData.compile({ ipfsHash: generatedHash })
        }];

        const tx = await writeContract(starknetCalls);

        setIsPending(false);
        setIsConfirming(true);
        toast.loading("Waiting for blockchain confirmation...", { id: "mintToast" });

        // ✅ Pass expectedOnChainId so the DB record gets the correct on-chain integer ID
        handleTransactionSuccess(tx.transaction_hash, dbArticle, generatedHash, expectedOnChainId);

      } catch (err) {
        console.error(err);
        toast.error("Transaction rejected or failed", { id: "mintToast" });
        setIsPending(false);
        setIsConfirming(false);
        setLoading(false);
        setStepIndex(-1);
        if (dbArticle?.id) { deleteArticleFromDB(dbArticle.id); setSavedArticle(null); }
      }

    } catch (err) {
      setError(err.message); toast.error(err.message || "Curation failed");
      if (savedArticle?.id) { deleteArticleFromDB(savedArticle.id); setSavedArticle(null); }
      setStepIndex(-1); setLoading(false);
    }
  };

  // ✅ Added onChainId parameter
  const handleTransactionSuccess = async (txHash, article, hash, onChainId) => {
    setIsConfirming(false);
    const txHashStr = txHash || "starknet-tx";

    if (address) {
      try {
        await markArticleOnChainDB(
          article.articleUrl || url,
          article.id,        // DB ObjectId for WHERE lookup
          onChainId,         // ✅ on-chain integer ID — stored in articleId field
          address,
          hash,
          txHashStr
        );

        setStepIndex(3);
        setTxDone(true);
        toast.success("Curated on Starknet!", { id: "mintToast" });
        setLoading(false);
        setTimeout(() => navigate("/curated"), 2000);
      } catch (err) {
        console.error(err);
        toast.error("DB sync failed", { id: "mintToast" });
        setLoading(false);
      }
    } else {
      setStepIndex(3);
      setTxDone(true);
      toast.success("Minted!", { id: "mintToast" });
      setLoading(false);
      setTimeout(() => navigate("/curated"), 2000);
    }
  };

  const handleReset = () => {
    setUrl(""); setScrapedPreview(null); setError(null);
    setSavedArticle(null); setIpfsHash(null); setTxDone(false); setStepIndex(-1);
  };

  const isProcessing = loading || isPending || isConfirming;

  const getButtonLabel = () => {
    if (stepIndex === -1 && !loading) return "Curate & Mint";
    if (stepIndex === 0) return "Saving Database...";
    if (stepIndex === 1) return "Pinning to IPFS...";
    if (stepIndex === 2 && (isPending || isConfirming)) return "Confirming on Starknet...";
    if (txDone) return "Successfully Minted!";
    return "Curate & Mint";
  };

  const steps = [
    { icon: Search, title: "Input", desc: "Paste any article URL." },
    { icon: Zap, title: "Process", desc: "AI extracts & summarizes insights." },
    { icon: Save, title: "Store", desc: "Saved to DB + IPFS." },
    { icon: Link2, title: "Mint", desc: "Verifiable record on Starknet." },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <BlockchainBackground />
      <Navbar />
      <main className="flex-grow relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <Section className="py-12">
            <div className="text-center mb-8">
              <button onClick={() => navigate("/research")} className="inline-flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all text-sm backdrop-blur-sm shadow-md">
                <ArrowLeft className="w-4 h-4" /> Back to AI Engine
              </button>
            </div>
            <div className="text-center mb-12 animate-fade-in">
              <Badge className="mb-6 bg-orange-500/10 text-orange-400 border border-orange-500/20">Legacy Mode</Badge>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
                Curate any{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">Article.</span>
              </h1>
              <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Paste a URL → AI summarizes → Saved to DB → Pinned to IPFS → Minted on Starknet.
              </p>
            </div>
            <div className="max-w-3xl mx-auto mb-12 relative z-10">
              <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl flex flex-col sm:flex-row gap-3 shadow-xl focus-within:border-emerald-500/50 transition-all">
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScrape(e)} placeholder="Paste article URL here..." className="flex-1 bg-transparent px-6 py-4 text-white placeholder-zinc-500 focus:outline-none text-lg w-full" disabled={isProcessing} />
                <Button onClick={handleScrape} disabled={isProcessing || !url.trim()} size="lg" className="px-8 whitespace-nowrap shadow-lg shadow-emerald-500/20">
                  {loading && !scrapedPreview ? <><Loader className="w-5 h-5 animate-spin mr-2" /> Scraping...</> : <><Search className="w-5 h-5 mr-2" /> Analyze</>}
                </Button>
              </div>
            </div>
            {error && <div className="max-w-xl mx-auto mb-8 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center text-sm">Error: {error}</div>}
            {scrapedPreview && (
              <Card className="max-w-4xl mx-auto overflow-hidden animate-fade-in mb-16 border border-zinc-800 bg-zinc-900/40 backdrop-blur-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-xs text-zinc-400 uppercase tracking-widest">Ready to Curate</span>
                  </div>
                  <button onClick={handleReset} disabled={isProcessing} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8">
                  <div className="flex flex-col md:flex-row gap-8 mb-10">
                    {scrapedPreview.imageUrl && (
                      <div className="w-full md:w-1/3 aspect-[4/3] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-md">
                        <img src={scrapedPreview.imageUrl} className="w-full h-full object-cover transition-transform hover:scale-105 duration-700" alt="Preview" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-center">
                      <h2 className="text-2xl font-bold text-white mb-4 leading-snug">{scrapedPreview.title}</h2>
                      <div className="bg-zinc-950/50 border border-zinc-800/80 p-4 rounded-xl mb-4">
                        <p className="text-zinc-300 text-sm leading-relaxed line-clamp-3">{scrapedPreview.summary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {scrapedPreview.keyPoints?.slice(0, 3).map((pt, i) => (
                          <span key={i} className="text-[11px] font-medium bg-zinc-900 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-800/80">{pt.substring(0, 45)}{pt.length > 45 ? "..." : ""}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 mb-8">
                    {[
                      { label: "Database Sync", done: stepIndex > 0, active: stepIndex === 0, val: savedArticle ? `ID: ${savedArticle.id?.slice(-8)}` : null },
                      { label: "IPFS Pinning", done: stepIndex > 1, active: stepIndex === 1, val: ipfsHash ? `${ipfsHash.slice(0, 16)}...` : null },
                      { label: "Blockchain Mint", done: txDone, active: stepIndex === 2, val: null },
                    ].map((row, idx) => (
                      <div key={idx} className={`flex items-center justify-between px-5 py-3.5 rounded-xl border text-sm transition-all ${row.done ? "border-emerald-500/30 bg-emerald-500/5" : row.active ? "border-emerald-500/60 bg-emerald-500/10" : "border-zinc-800/60 bg-zinc-950/30"}`}>
                        <div className="flex items-center gap-3">
                          {row.done ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : row.active ? <Loader className="w-4 h-4 text-emerald-400 animate-spin" /> : <Circle className="w-4 h-4 text-zinc-600" />}
                          <span className={row.done ? "text-emerald-400 font-medium" : row.active ? "text-white font-medium" : "text-zinc-500"}>{row.label}</span>
                        </div>
                        {row.val && <span className="font-mono text-[11px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded">{row.val}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-6 border-t border-zinc-800/50">
                    <Button onClick={handleCurate} disabled={isProcessing || txDone || !isConnected} size="lg" className={`px-8 py-3.5 ${txDone ? "bg-emerald-500 hover:bg-emerald-500 text-black cursor-default" : "shadow-lg shadow-emerald-500/20"}`}>
                      {isProcessing && <Loader className="w-4 h-4 animate-spin mr-2" />}
                      {!isConnected ? "Connect Wallet to Mint" : getButtonLabel()}
                      {!isProcessing && !txDone && isConnected && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {!scrapedPreview && !loading && (
              <div className="pt-16 border-t border-zinc-800/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {steps.map((step, i) => (
                    <Card key={i} className="p-8 bg-zinc-900/30 backdrop-blur-md border border-zinc-800/50 hover:border-emerald-500/30 transition-all group">
                      <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mb-6 border border-zinc-800 group-hover:border-emerald-500/50 transition-colors">
                        <step.icon className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                      <p className="text-zinc-500 text-sm leading-relaxed">{step.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}