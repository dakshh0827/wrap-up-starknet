import { PrismaClient } from '@prisma/client';
import { uploadToIPFS } from '../services/ipfs.js';
import { num } from 'starknet'; // STARKNET ADDED: Required for accurate address formatting

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helper: Normalize Starknet addresses (lowercase for consistent DB querying)
// ---------------------------------------------------------------------------
const normalizeAddress = (address) => {
  if (!address) return null;
  return address.toLowerCase();
};

// ---------------------------------------------------------------------------
// Helper: resolve a wallet address to a human-readable display name.
// ---------------------------------------------------------------------------
const getUserDisplayName = async (walletAddress) => {
  try {
    if (!walletAddress || walletAddress.startsWith('anon_')) return 'Anonymous';
    
    const normalized = normalizeAddress(walletAddress);
    const user = await prisma.user.findUnique({ where: { walletAddress: normalized } });
    
    // Fallback for Starknet addresses (which are usually 64+ chars long)
    return user?.displayName
      || `${normalized.substring(0, 6)}...${normalized.substring(normalized.length - 4)}`;
  } catch {
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  }
};

// ---------------------------------------------------------------------------
// POST /api/comments
// Create a comment or a reply (set parentId for replies).
// Saved with onChain: false — IPFS + blockchain steps follow separately.
// ---------------------------------------------------------------------------
export const addComment = async (req, res, next) => {
  try {
    const { articleId, articleUrl, content, author, authorName, parentId } = req.body;

    if (!articleId || !articleUrl || !content || !author) {
      return res.status(400).json({
        error: 'articleId, articleUrl, content and author are required',
      });
    }

    const normalizedAuthor = normalizeAddress(author);

    // Validate parent exists if this is a reply.
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const finalAuthorName = authorName || (await getUserDisplayName(normalizedAuthor));

    const comment = await prisma.comment.create({
      data: {
        articleId,
        articleUrl,
        content,
        author: normalizedAuthor,
        authorName: finalAuthorName,
        parentId: parentId || null,
        onChain: false,
        upvotedBy: [],
      },
      include: { replies: true },
    });

    console.log(`✅ Comment ${comment.id} created${parentId ? ` (reply to ${parentId})` : ''}`);
    res.status(201).json(comment);
  } catch (error) {
    console.error('addComment error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/comments/upload-ipfs
// Pin comment metadata to IPFS. Returns the hash for the blockchain call.
// ---------------------------------------------------------------------------
export const uploadCommentToIPFS = async (req, res, next) => {
  try {
    const { commentId, content, author, authorName, articleUrl } = req.body;

    if (!commentId || !content || !author) {
      return res.status(400).json({ error: 'commentId, content and author are required' });
    }

    const normalizedAuthor = normalizeAddress(author);
    const finalAuthorName = authorName || (await getUserDisplayName(normalizedAuthor));
    
    const metadata = {
      content,
      author: normalizedAuthor,
      authorName: finalAuthorName,
      articleUrl: articleUrl || '',
      timestamp: new Date().toISOString(),
    };

    const ipfsHash = await uploadToIPFS(metadata);

    // Persist the hash so mark-onchain can reference it.
    await prisma.comment.update({
      where: { id: commentId },
      data: { ipfsHash },
    });

    console.log(`📤 Comment ${commentId} → IPFS: ${ipfsHash}`);
    res.json({ ipfsHash, commentId });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/comments/mark-onchain
// Called AFTER the Starknet tx confirms. Stores the on-chain comment ID.
// ---------------------------------------------------------------------------
export const markCommentOnChain = async (req, res, next) => {
  try {
    const { commentId, onChainCommentId, ipfsHash } = req.body;

    if (!commentId || !onChainCommentId || !ipfsHash) {
      return res.status(400).json({
        error: 'commentId, onChainCommentId and ipfsHash are required',
      });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        onChain: true,
        commentId: parseInt(onChainCommentId, 10),
        ipfsHash,
      },
    });

    console.log(`⛓  Comment ${commentId} on-chain as #${onChainCommentId}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/comments/by-article?articleUrl=...
// Top-level comments (parentId === null) with their nested replies.
// ---------------------------------------------------------------------------
export const getCommentsByArticleUrl = async (req, res, next) => {
  try {
    const { articleUrl } = req.query;

    if (!articleUrl) {
      return res.status(400).json({ error: 'articleUrl query parameter is required' });
    }

    const comments = await prisma.comment.findMany({
      where: { articleUrl, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/comments/:commentId/replies
// Direct replies for a single comment.
// ---------------------------------------------------------------------------
export const getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    const replies = await prisma.comment.findMany({
      where: { parentId: commentId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(replies);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/comments/upvote
// DB-level upvote (wallet-optional). Prevents double-voting via upvotedBy array.
// ---------------------------------------------------------------------------
export const upvoteComment = async (req, res, next) => {
  try {
    const { commentId, userId } = req.body;

    if (!commentId || !userId) {
      return res.status(400).json({ error: 'commentId and userId are required' });
    }

    const normalizedUserId = normalizeAddress(userId);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const upvotedByArray = Array.isArray(comment.upvotedBy) ? comment.upvotedBy : [];
    
    // Check against normalized string or object format
    const hasUpvoted = upvotedByArray.some((v) =>
      typeof v === 'string' 
        ? normalizeAddress(v) === normalizedUserId 
        : normalizeAddress(v.address) === normalizedUserId
    );
    
    if (hasUpvoted) return res.status(400).json({ error: 'Already upvoted this comment' });

    const displayName = await getUserDisplayName(normalizedUserId);
    
    const updated = await prisma.comment.update({
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
    console.error('upvoteComment error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/comments/sync-upvotes
// Overwrite the DB upvote count with the authoritative on-chain value.
// Uses the MongoDB _id (not the on-chain commentId).
// ---------------------------------------------------------------------------
export const syncCommentUpvotes = async (req, res, next) => {
  try {
    const { commentId, upvotes } = req.body;

    if (!commentId || upvotes === undefined) {
      return res.status(400).json({ error: 'commentId and upvotes are required' });
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { upvotes: parseInt(upvotes, 10) },
    });

    console.log(`🔄 Comment ${commentId} upvotes synced → ${upvotes}`);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};