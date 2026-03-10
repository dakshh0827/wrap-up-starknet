import { PrismaClient } from '@prisma/client';
import { conductMultiSourceResearch } from '../services/researchEngine.js';
import { synthesizeResearchReport } from '../services/reportSynthesizer.js';
import { uploadToIPFS } from '../services/ipfs.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// STARKNET ADDED: Import your Starknet client and ABIs for on-chain verification
import { provider, getContract, CONTRACT_ADDRESSES } from '../utils/starknetClient.js';

// ESM friendly JSON import
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WRAPUP_ABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/WrapUp.json'), 'utf8'));

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper: resolve wallet address → display name
// STARKNET MODIFIED: Adjusted substring logic for 66-character Starknet hex addresses
// ---------------------------------------------------------------------------
const getUserDisplayName = async (walletAddress) => {
  try {
    if (!walletAddress || walletAddress.startsWith('anon_')) return 'Anonymous';
    
    // Ensure lowercase for standard DB lookups
    const normalizedAddress = walletAddress.toLowerCase();
    const user = await prisma.user.findUnique({ where: { walletAddress: normalizedAddress } });
    
    // Starknet addresses are 0x + 64 chars. Fallback formatting: 0x1234...abcd
    return user?.displayName
      || `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
  } catch {
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/initiate
// PHASE 1: Run multi-source search and return a preview without persisting.
// ---------------------------------------------------------------------------
export const initiateResearch = async (req, res, next) => {
  try {
    const { topic, userContext } = req.body;

    if (!topic || topic.trim().length < 5) {
      return res.status(400).json({ error: 'Topic must be at least 5 characters' });
    }

    console.log(`🔬 Initiating research: "${topic}"`);

    const cached = await prisma.research.findFirst({
      where: {
        topic: topic.trim(),
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (cached) {
      console.log('✅ Returning cached research');
      return res.json({
        cached: true,
        researchId: cached.id,
        preview: {
          topic: cached.topic,
          sourcesFound: cached.sources.length,
          status: 'completed',
        },
      });
    }

    console.log('🌐 Searching across platforms...');
    const sources = await conductMultiSourceResearch(topic, userContext);
    console.log(`✅ ${sources.length} sources found`);

    res.json({
      cached: false,
      preview: {
        topic,
        sourcesFound: sources.length,
        status: 'sources_collected',
        sources: sources.map((s) => ({
          platform: s.platform,
          title: s.title,
          url: s.url,
        })),
      },
    });
  } catch (error) {
    console.error('initiateResearch error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/generate
// PHASE 2: Multiplexed endpoint.
// If action === 'prepare', saves the report JSON to the DB.
// Otherwise, runs the AI synthesis and returns a preview WITHOUT saving to DB.
// ---------------------------------------------------------------------------
export const generateResearchReport = async (req, res, next) => {
  try {
    const { topic, userContext, action, reportData } = req.body;

    // Save to Database Stage (equivalent to Legacy prepare)
    if (action === 'prepare') {
      if (!reportData) return res.status(400).json({ error: 'reportData is required for prepare action' });
      
      console.log(`💾 Saving research to database for: "${reportData.topic}"`);
      const savedResearch = await prisma.research.create({
        data: {
          topic: reportData.topic.trim(),
          executiveSummary: reportData.executiveSummary,
          keyInsights: reportData.keyInsights,
          sources: reportData.sources,
          comparativeAnalysis: reportData.comparativeAnalysis,
          consensusVsContradiction: reportData.consensusVsContradiction,
          visualizationData: reportData.visualizationData,
          sourceComparisonReport: reportData.sourceComparisonReport || null,
          metadata: reportData.metadata,
          onChain: false,
          upvotedBy: [],
        },
      });
      console.log(`✅ Research saved: ${savedResearch.id}`);
      return res.json({ researchId: savedResearch.id, report: savedResearch });
    }

    // AI Generation Stage (equivalent to Legacy scrape preview)
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    console.log(`📊 Generating preview report for: "${topic}"`);
    const sources = await conductMultiSourceResearch(topic, userContext);

    if (sources.length === 0) {
      return res.status(404).json({
        error: 'No sources found',
        message: 'Unable to find sufficient sources. Try a more specific query.',
      });
    }

    console.log(`📝 Synthesizing from ${sources.length} sources...`);
    const report = await synthesizeResearchReport(topic, sources);

    res.json({
      previewOnly: true,
      report: {
        topic: topic.trim(),
        executiveSummary: report.executiveSummary,
        keyInsights: report.keyInsights,
        sources: report.sources,
        comparativeAnalysis: report.comparativeAnalysis,
        consensusVsContradiction: report.consensusVsContradiction,
        visualizationData: report.visualizationData,
        sourceComparisonReport: report.sourceComparisonReport || null,
        metadata: {
          totalSources: sources.length,
          platforms: [...new Set(sources.map((s) => s.platform))],
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('generateResearchReport error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/upload-ipfs
// Pin the research report to IPFS.
// ---------------------------------------------------------------------------
export const uploadResearchToIPFS = async (req, res, next) => {
  try {
    const { researchId } = req.body;

    if (!researchId) {
      return res.status(400).json({ error: 'researchId is required' });
    }

    const research = await prisma.research.findUnique({ where: { id: researchId } });
    if (!research) return res.status(404).json({ error: 'Research not found' });

    console.log(`📤 Uploading research "${research.topic}" to IPFS...`);

    const ipfsData = {
      topic: research.topic,
      executiveSummary: research.executiveSummary,
      keyInsights: research.keyInsights,
      sources: research.sources,
      comparativeAnalysis: research.comparativeAnalysis,
      consensusVsContradiction: research.consensusVsContradiction,
      visualizationData: research.visualizationData,
      metadata: research.metadata,
      generatedAt: research.createdAt.toISOString(),
    };

    const ipfsHash = await uploadToIPFS(ipfsData);
    console.log(`✅ Research IPFS hash: ${ipfsHash}`);

    await prisma.research.update({
      where: { id: researchId },
      data: { ipfsHash },
    });

    res.json({ ipfsHash, researchId });
  } catch (error) {
    console.error('uploadResearchToIPFS error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/mark-onchain
// ---------------------------------------------------------------------------
export const markResearchOnChain = async (req, res, next) => {
  try {
    const { researchId, blockchainId, curator, ipfsHash } = req.body;

    if (!researchId || !blockchainId || !curator || !ipfsHash) {
      return res.status(400).json({
        error: 'researchId, blockchainId, curator and ipfsHash are all required',
      });
    }

    const normalizedCurator = curator.toLowerCase();
    const curatorName = await getUserDisplayName(normalizedCurator);

    const updated = await prisma.research.update({
      where: { id: researchId },
      data: {
        onChain: true,
        blockchainId: parseInt(blockchainId, 10),
        curator: normalizedCurator,
        curatorName,
        ipfsHash,
      },
    });

    console.log(`⛓  Research ${researchId} on-chain as #${blockchainId} on Starknet`);
    res.json(updated);
  } catch (error) {
    console.error('markResearchOnChain error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/research/:id
// ---------------------------------------------------------------------------
export const getResearchById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('📖 Fetching research:', id);

    const research = await prisma.research.findUnique({
      where: { id },
      include: {
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            replies: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!research) {
      return res.status(404).json({ error: 'Research report not found' });
    }

    console.log(`✅ Research found, ${research.comments?.length ?? 0} top-level comments`);
    res.json(research);
  } catch (error) {
    console.error('getResearchById error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/research
// ---------------------------------------------------------------------------
export const getAllResearch = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, includeOffChain = 'false' } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const whereClause = includeOffChain === 'true' ? {} : { onChain: true };

    const [research, total] = await Promise.all([
      prisma.research.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
        select: {
          id: true,
          blockchainId: true,
          topic: true,
          executiveSummary: true,
          metadata: true,
          curator: true,
          curatorName: true,
          onChain: true,
          upvotes: true,
          createdAt: true,
          _count: { select: { comments: true } },
        },
      }),
      prisma.research.count({ where: whereClause }),
    ]);

    res.json({
      research: research.map((r) => ({ ...r, commentCount: r._count.comments })),
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('getAllResearch error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/upvote
// ---------------------------------------------------------------------------
export const upvoteResearch = async (req, res, next) => {
  try {
    const { researchId, userId } = req.body;

    if (!researchId || !userId) {
      return res.status(400).json({ error: 'researchId and userId are required' });
    }

    const normalizedUserId = userId.toLowerCase();

    const research = await prisma.research.findUnique({ where: { id: researchId } });
    if (!research) return res.status(404).json({ error: 'Research not found' });

    const upvotedByArray = Array.isArray(research.upvotedBy) ? research.upvotedBy : [];
    const hasUpvoted = upvotedByArray.some((v) =>
      typeof v === 'string' ? v.toLowerCase() === normalizedUserId : v.address?.toLowerCase() === normalizedUserId
    );
    if (hasUpvoted) return res.status(400).json({ error: 'Already upvoted this research' });

    const displayName = await getUserDisplayName(normalizedUserId);
    const updated = await prisma.research.update({
      where: { id: researchId },
      data: {
        upvotes: { increment: 1 },
        upvotedBy: {
          push: { address: normalizedUserId, name: displayName, timestamp: new Date().toISOString() },
        },
      },
    });

    res.json({ success: true, upvotes: updated.upvotes });
  } catch (error) {
    console.error('upvoteResearch error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/sync-upvotes
// STARKNET ADDED: Optional on-chain verification of the actual Cairo contract state
// ---------------------------------------------------------------------------
export const syncResearchUpvotes = async (req, res, next) => {
  try {
    const { researchId, upvotes } = req.body;

    if (!researchId || upvotes === undefined) {
      return res.status(400).json({ error: 'researchId and upvotes are required' });
    }

    const research = await prisma.research.findUnique({ where: { id: researchId } });
    if (!research) return res.status(404).json({ error: 'Research not found' });

    let finalUpvotes = parseInt(upvotes, 10);

    // If the research is on-chain, verify the upvote count directly from Starknet Devnet
    if (research.onChain && research.blockchainId !== null) {
      try {
        const wrapUpContract = getContract(WRAPUP_ABI.abi || WRAPUP_ABI, CONTRACT_ADDRESSES.wrapUp);
        // Call the Cairo 'getArticle' function which returns an Article struct
        const articleStruct = await wrapUpContract.getArticle(research.blockchainId);
        
        if (articleStruct && articleStruct.upvoteCount !== undefined) {
          finalUpvotes = Number(articleStruct.upvoteCount.toString());
          console.log(`✅ Starknet verified upvotes for ID ${research.blockchainId}: ${finalUpvotes}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch from Starknet contract, falling back to client provided data. Error:`, err.message);
      }
    }

    const updated = await prisma.research.update({
      where: { id: researchId },
      data: { upvotes: finalUpvotes },
    });

    console.log(`🔄 Research ${researchId} upvotes synced → ${finalUpvotes}`);
    res.json(updated);
  } catch (error) {
    console.error('syncResearchUpvotes error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/research/:id
// Remove a DB record on Tx fail.
// ---------------------------------------------------------------------------
export const deleteResearch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const research = await prisma.research.findUnique({ where: { id } });
    if (!research) return res.status(404).json({ error: 'Research not found' });
    if (research.onChain) {
      return res.status(400).json({ error: 'Cannot delete an on-chain research report' });
    }

    await prisma.research.delete({ where: { id } });
    res.json({ message: 'Research deleted successfully' });
  } catch (error) {
    console.error('deleteResearch error:', error);
    next(error);
  }
};