import { PrismaClient } from '@prisma/client';
import { compareArticles } from '../services/comparatorService.js';
import { uploadToIPFS } from '../services/ipfs.js';

const prisma = new PrismaClient();

// STARKNET FIX: Starknet addresses have varying lengths (dropped leading zeros).
// We MUST pad them to exactly 66 characters (0x + 64 hex chars) for safe DB lookups.
const normalizeStarknetAddress = (address) => {
  if (!address) return address;
  let hex = address.toLowerCase();
  if (hex.startsWith('0x')) {
    // Pad the string with leading zeros until it hits 64 characters (plus the 2 for '0x')
    hex = '0x' + hex.slice(2).padStart(64, '0');
  }
  return hex;
};

const getUserDisplayName = async (walletAddress) => {
  try {
    if (!walletAddress || walletAddress.startsWith('anon_')) return 'Anonymous';
    
    const normalizedAddress = normalizeStarknetAddress(walletAddress);
    const user = await prisma.user.findUnique({ where: { walletAddress: normalizedAddress } });
    
    if (user?.displayName) return user.displayName;
    
    // STARKNET FIX: Grabbing the start and end of the now perfectly formatted 66-char address
    return `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
  } catch {
    return 'Anonymous';
  }
};

/**
 * POST /api/comparisons/generate
 * Multiplexed endpoint.
 * If action === 'prepare', saves the provided comparison JSON to DB.
 * Otherwise, scrapes both articles and runs AI comparison, returning preview data WITHOUT saving.
 */
export const generateComparison = async (req, res, next) => {
  try {
    const { urlOne, urlTwo, action, comparisonData } = req.body;

    // Save to Database Stage (equivalent to Legacy prepare)
    if (action === 'prepare') {
      if (!comparisonData) return res.status(400).json({ error: 'comparisonData is required' });
      
      console.log(`💾 Saving comparison to database...`);
      const comparison = await prisma.comparison.create({
        data: {
          articleOneUrl: comparisonData.articleOneUrl,
          articleTwoUrl: comparisonData.articleTwoUrl,
          articleOneTitle: comparisonData.articleOneTitle,
          articleTwoTitle: comparisonData.articleTwoTitle,
          articleOneMeta: comparisonData.articleOneMeta,
          articleTwoMeta: comparisonData.articleTwoMeta,
          report: comparisonData.report,
          verdict: comparisonData.verdict,
          onChain: false,
          upvotes: 0,
          upvotedBy: [],
        },
      });
      console.log(`✅ Comparison saved to DB: ${comparison.id}`);
      return res.json({ comparisonId: comparison.id, comparison });
    }

    // AI Generation Stage (equivalent to Legacy scrape preview)
    if (!urlOne || !urlTwo) {
      return res.status(400).json({ error: 'Both article URLs (urlOne, urlTwo) are required' });
    }

    try { new URL(urlOne); new URL(urlTwo); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }
    if (urlOne === urlTwo) return res.status(400).json({ error: 'Please provide two different URLs' });

    // Cache check for completely curated ones
    const [sortedOne, sortedTwo] = [urlOne, urlTwo].sort();
    const existing = await prisma.comparison.findFirst({
      where: {
        OR: [
          { articleOneUrl: sortedOne, articleTwoUrl: sortedTwo },
          { articleOneUrl: sortedTwo, articleTwoUrl: sortedOne },
        ],
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (existing) {
      console.log('✅ Returning cached comparison:', existing.id);
      return res.json({ cached: true, previewOnly: !existing.onChain, comparison: existing });
    }

    console.log('🔬 Running new comparison preview...');
    const { articleOne, articleTwo, report } = await compareArticles(urlOne, urlTwo);

    const previewComparison = {
      articleOneUrl: urlOne,
      articleTwoUrl: urlTwo,
      articleOneTitle: articleOne.title || 'Untitled',
      articleTwoTitle: articleTwo.title || 'Untitled',
      articleOneMeta: {
        title: articleOne.title,
        author: articleOne.author,
        publisher: articleOne.publisher,
        date: articleOne.date,
        image: articleOne.image,
        description: articleOne.description,
      },
      articleTwoMeta: {
        title: articleTwo.title,
        author: articleTwo.author,
        publisher: articleTwo.publisher,
        date: articleTwo.date,
        image: articleTwo.image,
        description: articleTwo.description,
      },
      report,
      verdict: report.verdict?.shortVerdict || 'Comparison complete',
    };

    res.json({ cached: false, previewOnly: true, comparison: previewComparison });
  } catch (error) {
    console.error('Generate comparison error:', error.message);
    next(error);
  }
};

/**
 * GET /api/comparisons/:id
 */
export const getComparisonById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comparison = await prisma.comparison.findUnique({ where: { id } });
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    res.json(comparison);
  } catch (error) { next(error); }
};

/**
 * GET /api/comparisons?page=1&limit=12
 */
export const getAllComparisons = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '12', 10)));
    const skip = (page - 1) * limit;

    const [comparisons, total] = await Promise.all([
      prisma.comparison.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.comparison.count(),
    ]);

    res.json({ comparisons, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

/**
 * POST /api/comparisons/upload-ipfs
 */
export const uploadComparisonToIPFS = async (req, res, next) => {
  try {
    const { comparisonId } = req.body;
    if (!comparisonId) return res.status(400).json({ error: 'comparisonId is required' });

    const comparison = await prisma.comparison.findUnique({ where: { id: comparisonId } });
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });

    const ipfsData = {
      articleOneUrl: comparison.articleOneUrl,
      articleTwoUrl: comparison.articleTwoUrl,
      articleOneTitle: comparison.articleOneTitle,
      articleTwoTitle: comparison.articleTwoTitle,
      verdict: comparison.verdict,
      report: comparison.report,
      createdAt: comparison.createdAt,
    };

    const ipfsHash = await uploadToIPFS(ipfsData);

    await prisma.comparison.update({
      where: { id: comparisonId },
      data: { ipfsHash },
    });

    console.log(`📤 Comparison ${comparisonId} uploaded to IPFS: ${ipfsHash}`);
    res.json({ ipfsHash, comparisonId });
  } catch (error) {
    console.error('Upload comparison to IPFS error:', error);
    next(error);
  }
};

/**
 * POST /api/comparisons/mark-onchain
 */
export const markComparisonOnChain = async (req, res, next) => {
  try {
    const { comparisonId, blockchainId, curator, ipfsHash } = req.body;

    if (!comparisonId || !blockchainId || !curator || !ipfsHash) {
      return res.status(400).json({ error: 'comparisonId, blockchainId, curator and ipfsHash are all required' });
    }

    // STARKNET ADDITION: Normalize the curator address before interacting with the database
    const normalizedCurator = normalizeStarknetAddress(curator);
    const curatorName = await getUserDisplayName(normalizedCurator);

    const updated = await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        onChain: true,
        blockchainId: parseInt(blockchainId, 10), // Starknet uses u256, assuming the cast maps cleanly here
        curator: normalizedCurator,
        curatorName,
        ipfsHash,
      },
    });

    console.log(`⛓ Comparison ${comparisonId} marked on-chain with id ${blockchainId}`);
    res.json(updated);
  } catch (error) {
    console.error('Mark comparison on-chain error:', error);
    next(error);
  }
};

/**
 * POST /api/comparisons/upvote
 */
export const upvoteComparison = async (req, res, next) => {
  try {
    const { comparisonId, userId } = req.body;
    if (!comparisonId || !userId) return res.status(400).json({ error: 'comparisonId and userId are required' });

    const comparison = await prisma.comparison.findUnique({ where: { id: comparisonId } });
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });

    // STARKNET ADDITION: Normalize user ID to prevent duplicate votes from casing differences
    const normalizedUserId = normalizeStarknetAddress(userId);

    const upvotedByArray = Array.isArray(comparison.upvotedBy) ? comparison.upvotedBy : [];
    const hasUpvoted = upvotedByArray.some((v) => typeof v === 'string' ? v === normalizedUserId : v.address === normalizedUserId);
    
    if (hasUpvoted) return res.status(400).json({ error: 'Already upvoted this comparison' });

    const displayName = await getUserDisplayName(normalizedUserId);

    const updated = await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        upvotes: { increment: 1 },
        upvotedBy: { push: { address: normalizedUserId, name: displayName, timestamp: new Date().toISOString() } },
      },
    });

    res.json({ success: true, upvotes: updated.upvotes });
  } catch (error) {
    console.error('Upvote comparison error:', error);
    next(error);
  }
};

/**
 * DELETE /api/comparisons/:id
 * Clear orphaned DB record on Tx fail.
 */
export const deleteComparison = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comparison = await prisma.comparison.findUnique({ where: { id } });
    if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
    if (comparison.onChain) return res.status(400).json({ error: 'Cannot delete an on-chain comparison' });

    await prisma.comparison.delete({ where: { id } });
    res.json({ message: 'Comparison deleted successfully' });
  } catch (error) { next(error); }
};