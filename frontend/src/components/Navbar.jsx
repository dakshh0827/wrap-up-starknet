import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useArticleStore } from "../stores/articleStore";

// STARKNET FIX: Removed useWaitForTransaction
import { 
  useAccount, 
  useConnect, 
  useDisconnect, 
  useReadContract, 
  useSendTransaction 
} from "@starknet-react/core";

import { 
  WUP_CLAIMER_ABI, CONTRACT_ADDRESSES, WRAPUP_ABI, WUPToken_ADDRESSES, WUP_TOKEN_ABI, WUPClaimer_ADDRESSES,
} from "../wagmiConfig";
import toast from "react-hot-toast";
import axios from "axios";
import { 
  Menu, X, Check, Brain, FileText, Wallet, Link2, Scale, Hexagon, ChevronDown, Zap
} from "lucide-react";

const API_BASE = '/api';

export default function Navbar() {
  const { userPoints, displayName, setUserPoints, setDisplayName } = useArticleStore();
  const [newName, setNewName] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savingToDb, setSavingToDb] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);
  
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Manual loading states replacing useWaitForTransaction
  const [isSettingName, setIsSettingName] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const toolsCloseTimer = useRef(null);
  const rewardsCloseTimer = useRef(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path;
   
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect(); 
  const { disconnect } = useDisconnect();

  const currentContractAddress = CONTRACT_ADDRESSES.devnet; 
  const currentTokenAddress = WUPToken_ADDRESSES.devnet;    
  const currentClaimerAddress = WUPClaimer_ADDRESSES.devnet;  

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: pointsData, refetch: refetchPoints } = useReadContract({
    abi: WRAPUP_ABI,
    address: currentContractAddress,
    functionName: 'getUserPoints',
    args: address ? [address] : [], 
  });

  const { data: nameData, refetch: refetchName } = useReadContract({
    abi: WRAPUP_ABI,
    address: currentContractAddress,
    functionName: 'displayNames',
    args: address ? [address] : [],
  });

  const { data: wupBalance, refetch: refetchWupBalance } = useReadContract({
    address: currentTokenAddress,
    abi: WUP_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : [],
  });

  const { data: claimedPointsData, refetch: refetchClaimedPoints } = useReadContract({
    address: currentClaimerAddress,
    abi: WUP_CLAIMER_ABI,
    functionName: 'claimedPoints',
    args: address ? [address] : [],
  });
  
  const claimablePoints = (userPoints || 0) - (claimedPointsData ? Number(claimedPointsData.toString()) : 0);

  // STARKNET FIX: Prepare sendAsync
  const callsSetName = newName.trim() ? [{
    contractAddress: currentContractAddress,
    entrypoint: 'setDisplayName',
    calldata: [newName.trim()] 
  }] : [];

  const { sendAsync: writeSetName } = useSendTransaction({ calls: callsSetName });

  const callsClaim = [{
    contractAddress: currentClaimerAddress,
    entrypoint: 'claimReward',
    calldata: []
  }];

  const { sendAsync: writeClaimRewards } = useSendTransaction({ calls: callsClaim });

  useEffect(() => {
    if (isConnected && address) {
      refetchPoints();
      refetchName();
      refetchWupBalance();
      refetchClaimedPoints();
      fetchUserFromDb(address);
    } else {
      setUserPoints(0);
      setDisplayName('');
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (pointsData !== undefined) {
      setUserPoints(Number(pointsData.toString()));
    }
  }, [pointsData, setUserPoints]);

  useEffect(() => {
    if (nameData) {
        setDisplayName(nameData.toString()); 
    }
  }, [nameData, setDisplayName]);

  const fetchUserFromDb = async (walletAddress) => {
    try {
      const response = await axios.get(`${API_BASE}/users/${walletAddress}`);
      if (response.data && response.data.displayName && !nameData) {
        setDisplayName(response.data.displayName);
      }
    } catch (error) {
      console.log('User not found in DB:', error.message);
    }
  };

  const saveDisplayNameToDb = async (name, walletAddress) => {
    try {
      setSavingToDb(true);
      const response = await axios.post(`${API_BASE}/users/set-display-name`, {
        walletAddress,
        displayName: name
      });
      return response.data.success;
    } catch (error) {
      console.error('Failed to save to database:', error);
      return false;
    } finally {
      setSavingToDb(false);
    }
  };

  const handleSetDisplayName = async () => {
    if (!newName.trim() || newName.trim().length > 32) {
      toast.error("Invalid Name length");
      return;
    }
    toast.loading("Saving to database...", { id: "setNameToast" });
    const dbSaved = await saveDisplayNameToDb(newName.trim(), address);
    if (!dbSaved) {
      toast.error("Failed to save to DB.", { id: "setNameToast" });
      return;
    }
    
    setIsSettingName(true);
    toast.loading("Confirm in wallet...", { id: "setNameToast" });
    try {
      const tx = await writeSetName(); 
      toast.loading("Waiting for blockchain confirmation...", { id: "setNameToast" });
      // We don't strictly block UI on local devnet, we assume it passes if it didn't throw
      toast.success("Name saved on blockchain successfully!", { id: "setNameToast" });
      setDisplayName(newName);
      setNewName("");
      refetchName();
    } catch (err) {
      console.error(err);
      toast.error('Transaction Rejected or Failed', { id: 'setNameToast' });
    } finally {
      setIsSettingName(false);
    }
  };

  const handleClaim = async () => {
    if (claimablePoints <= 0) {
      toast.error('You have no points to claim!');
      return;
    }
    
    setIsClaiming(true);
    toast.loading('Confirm in your wallet...', { id: 'claim_toast' });
    try {
      await writeClaimRewards(); 
      toast.success('Tokens Claimed!', { id: 'claim_toast' });
      refetchWupBalance();
      refetchClaimedPoints();
      refetchPoints();
    } catch(err) {
      console.error(err);
      toast.error('Claim Rejected', { id: 'claim_toast' });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleWalletAction = () => {
    if (isConnected) {
      disconnect();
    } else {
      setIsWalletModalOpen(true); 
    }
  };

  const isClaimButtonDisabled = isClaiming || claimablePoints <= 0;
  const claimButtonText = () => {
    if (isClaiming) return 'Processing...';
    if (claimablePoints <= 0) return 'No Points';
    return 'Claim $WUP';
  };

  const toolLinks = [
    { path: '/research', label: 'Research', icon: Brain },
    { path: '/compare', label: 'Compare', icon: Scale },
    { path: '/legacy', label: 'Curate', icon: Link2 },
  ];
  const navLinks = [
    { path: '/curated', label: 'Articles', icon: FileText },
    { path: '/research-list', label: 'Reports', icon: Hexagon },
  ];

  const handleToolsEnter = () => { if (toolsCloseTimer.current) clearTimeout(toolsCloseTimer.current); setIsToolsOpen(true); };
  const handleToolsLeave = () => { toolsCloseTimer.current = setTimeout(() => setIsToolsOpen(false), 150); };
  const handleRewardsEnter = () => { if (rewardsCloseTimer.current) clearTimeout(rewardsCloseTimer.current); setIsRewardsOpen(true); };
  const handleRewardsLeave = () => { rewardsCloseTimer.current = setTimeout(() => setIsRewardsOpen(false), 150); };

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 shadow-xl shadow-black/20' : 'bg-transparent border-b border-transparent'}`}>
        <div className="w-full px-18 sm:px-10 lg:px-24 xl:px-28">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-900 border border-zinc-800 group-hover:border-emerald-500/50 transition-all overflow-hidden">
                <img src="/logo.png" alt="logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap">
                Wrap<span className="text-emerald-400">-Up</span>
              </span>
            </Link>
             
            {/* Mobile menu button */}
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all">
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2 relative">
              <div className="relative" onMouseEnter={handleToolsEnter} onMouseLeave={handleToolsLeave}>
                <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isToolsOpen ? 'text-white bg-zinc-800/50' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                  <Brain className="w-4 h-4" /> Tools <ChevronDown className={`w-3 h-3 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isToolsOpen && (
                  <div className="absolute top-full left-0 w-52 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl p-2 z-50" style={{ marginTop: '4px' }} onMouseEnter={handleToolsEnter} onMouseLeave={handleToolsLeave}>
                    <div className="absolute -top-1 left-0 right-0 h-2" />
                    {toolLinks.map(({ path, label, icon: Icon }) => (
                      <Link key={path} to={path} onClick={() => setIsToolsOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 transition-all">
                        <Icon className="w-4 h-4" />{label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {navLinks.map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive(path) ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                  <Icon className="w-4 h-4" />{label}
                </Link>
              ))}
            </div>

            {/* Right Section */}
            <div className="hidden lg:flex items-center gap-3">
              {isConnected && (
                <>
                  <div className="relative" onMouseEnter={handleRewardsEnter} onMouseLeave={handleRewardsLeave}>
                    <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${claimablePoints > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-300'}`}>
                      <Zap className={`w-4 h-4 ${claimablePoints > 0 ? 'text-emerald-400' : 'text-zinc-500'}`} /> Earnings
                    </button>
                    {isRewardsOpen && (
                      <div className="absolute top-full right-0 w-60 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-xl z-50 p-3 space-y-1" style={{ marginTop: '4px' }} onMouseEnter={handleRewardsEnter} onMouseLeave={handleRewardsLeave}>
                        <div className="flex justify-between px-3 py-2.5 bg-zinc-900 rounded-xl"><span className="text-zinc-400 text-xs uppercase">Points</span><span className="text-white text-sm">{userPoints}</span></div>
                        <div className="flex justify-between px-3 py-2.5 bg-zinc-900 rounded-xl"><span className="text-zinc-400 text-xs uppercase">Balance</span><span className="text-white text-sm">{wupBalance ? (Number(wupBalance.toString()) / 1e18).toFixed(2) : '0.00'}</span></div>
                        <button onClick={handleClaim} disabled={isClaimButtonDisabled} className="w-full mt-1 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400">{claimButtonText()}</button>
                      </div>
                    )}
                  </div>
                  {displayName ? (
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl"><span className="text-sm font-medium text-white">{displayName}</span></div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSetDisplayName()} disabled={isSettingName} className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm w-28 disabled:opacity-50" />
                      <button onClick={handleSetDisplayName} disabled={isSettingName} className="bg-zinc-800 px-3 py-2 rounded-xl text-white disabled:opacity-50"><Check className="w-4 h-4" /></button>
                    </div>
                  )}
                </>
              )}
              
              <button onClick={handleWalletAction} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${isConnected ? 'bg-zinc-900 border border-zinc-800 text-white' : 'bg-white text-black hover:bg-emerald-400'}`}>
                <Wallet className="w-4 h-4" />
                {isConnected ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isWalletModalOpen && !isConnected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl w-[90%] max-w-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button onClick={() => setIsWalletModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setIsWalletModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all rounded-xl text-white font-medium"
                >
                  {connector.id === 'argentX' ? 'Argent X' : connector.id === 'braavos' ? 'Braavos' : connector.name}
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
                     <Wallet className="w-4 h-4 text-emerald-400"/>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}