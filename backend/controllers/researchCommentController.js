import { PrismaClient } from '@prisma/client';
import { uploadToIPFS } from '../services/ipfs.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper: resolve wallet address → display name
// STARKNET FIX: Dynamically handle 66-character Cairo addresses instead of 42-char EVM
// --------------------------------------------------------------------------
const getUserDisplayName = async (walletAddress) => {
  try {
    if (!walletAddress || walletAddress.startsWith('anon_')) return 'Anonymous';
    
    // Starknet addresses can vary in casing, always normalize to lowercase for DB lookups
    const normalizedAddress = walletAddress.toLowerCase();
    
    const user = await prisma.user.findUnique({ where: { walletAddress: normalizedAddress } });
    
    return user?.displayName
      || `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  } catch {
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/comments
// Add a comment (or reply) to a research report.
// ---------------------------------------------------------------------------
export const addResearchComment = async (req, res, next) => {
  try {
    const { researchId, content, author, authorName, parentId } = req.body;

    if (!researchId || !content || !author) {
      return res.status(400).json({ error: 'researchId, content and author are required' });
    }

    // Ensure the research report exists.
    const research = await prisma.research.findUnique({ where: { id: researchId } });
    if (!research) return res.status(404).json({ error: 'Research report not found' });

    // Validate parent if replying.
    if (parentId) {
      const parent = await prisma.researchComment.findUnique({ where: { id: parentId } });
      if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
    }

    const normalizedAuthor = author.toLowerCase();
    const finalAuthorName = authorName || (await getUserDisplayName(normalizedAuthor));

    const comment = await prisma.researchComment.create({
      data: {
        researchId,
        content,
        author: normalizedAuthor,
        authorName: finalAuthorName,
        parentId: parentId || null,
        onChain: false,
        upvotedBy: [],
      },
      include: { replies: true },
    });

    console.log(`✅ ResearchComment ${comment.id} created${parentId ? ` (reply to ${parentId})` : ''}`);
    res.status(201).json(comment);
  } catch (error) {
    console.error('addResearchComment error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/comments/upload-ipfs
// Pin research comment metadata to IPFS.
// ---------------------------------------------------------------------------
export const uploadResearchCommentToIPFS = async (req, res, next) => {
  try {
    const { commentId, content, author, authorName, researchId } = req.body;

    if (!commentId || !content || !author) {
      return res.status(400).json({ error: 'commentId, content and author are required' });
    }

    const normalizedAuthor = author.toLowerCase();
    const finalAuthorName = authorName || (await getUserDisplayName(normalizedAuthor));
    
    const metadata = {
      content,
      author: normalizedAuthor,
      authorName: finalAuthorName,
      researchId: researchId || '',
      timestamp: new Date().toISOString(),
    };

    const ipfsHash = await uploadToIPFS(metadata);

    await prisma.researchComment.update({
      where: { id: commentId },
      data: { ipfsHash },
    });

    console.log(`📤 ResearchComment ${commentId} → IPFS: ${ipfsHash}`);
    res.json({ ipfsHash, commentId });
  } catch (error) {
    console.error('uploadResearchCommentToIPFS error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/comments/mark-onchain
// Called AFTER the blockchain tx confirms. Stores the on-chain comment ID.
// ---------------------------------------------------------------------------
export const markResearchCommentOnChain = async (req, res, next) => {
  try {
    const { commentId, onChainCommentId, ipfsHash } = req.body;

    if (!commentId || !onChainCommentId || !ipfsHash) {
      return res.status(400).json({
        error: 'commentId, onChainCommentId and ipfsHash are required',
      });
    }

    const updated = await prisma.researchComment.update({
      where: { id: commentId },
      data: {
        onChain: true,
        commentId: parseInt(onChainCommentId, 10), // Starknet u256 IDs can be parsed to int as long as they don't exceed MAX_SAFE_INTEGER
        ipfsHash,
      },
    });

    console.log(`⛓  ResearchComment ${commentId} on-chain as #${onChainCommentId}`);
    res.json(updated);
  } catch (error) {
    console.error('markResearchCommentOnChain error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/research/comments/by-research?researchId=...
// Top-level comments with nested replies.
// ---------------------------------------------------------------------------
export const getResearchComments = async (req, res, next) => {
  try {
    const { researchId } = req.query;

    if (!researchId) {
      return res.status(400).json({ error: 'researchId query parameter is required' });
    }

    const comments = await prisma.researchComment.findMany({
      where: { researchId, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });

    res.json(comments);
  } catch (error) {
    console.error('getResearchComments error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/research/comments/:commentId/replies
// ---------------------------------------------------------------------------
export const getResearchCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const replies = await prisma.researchComment.findMany({
      where: { parentId: commentId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(replies);
  } catch (error) {
    console.error('getResearchCommentReplies error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/comments/upvote
// ---------------------------------------------------------------------------
export const upvoteResearchComment = async (req, res, next) => {
  try {
    const { commentId, userId } = req.body;

    if (!commentId || !userId) {
      return res.status(400).json({ error: 'commentId and userId are required' });
    }

    const comment = await prisma.researchComment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const normalizedUserId = userId.toLowerCase();
    const upvotedByArray = Array.isArray(comment.upvotedBy) ? comment.upvotedBy : [];
    
    // Check against normalized Starknet addresses
    const hasUpvoted = upvotedByArray.some((v) =>
      typeof v === 'string' 
        ? v.toLowerCase() === normalizedUserId 
        : v.address.toLowerCase() === normalizedUserId
    );
    
    if (hasUpvoted) return res.status(400).json({ error: 'Already upvoted this comment' });

    const displayName = await getUserDisplayName(normalizedUserId);
    const updated = await prisma.researchComment.update({
      where: { id: commentId },
      data: {
        upvotes: { increment: 1 },
        upvotedBy: {
          push: { address: normalizedUserId, name: displayName, timestamp: new Date().toISOString() },
        },
      },
    });

    res.json({ success: true, upvotes: updated.upvotes });
  } catch (error) {
    console.error('upvoteResearchComment error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/research/comments/sync-upvotes
// ---------------------------------------------------------------------------
export const syncResearchCommentUpvotes = async (req, res, next) => {
  try {
    const { commentId, upvotes } = req.body;

    if (!commentId || upvotes === undefined) {
      return res.status(400).json({ error: 'commentId and upvotes are required' });
    }

    const updated = await prisma.researchComment.update({
      where: { id: commentId },
      data: { upvotes: parseInt(upvotes, 10) },
    });

    console.log(`🔄 ResearchComment ${commentId} upvotes synced → ${upvotes}`);
    res.json(updated);
  } catch (error) {
    console.error('syncResearchCommentUpvotes error:', error);
    next(error);
  }
};