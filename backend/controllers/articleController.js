import { PrismaClient } from '@prisma/client';
import { scrapeArticle } from '../services/scraper.js';
import { summarizeArticle } from '../services/summarizer.js';
import { uploadToIPFS } from '../services/ipfs.js';

const prisma = new PrismaClient();

// --------------------------------------------------------------------------
// Helper: resolve a wallet address to a human-readable display name.
// Falls back to a truncated address if no DB record exists.
// STARKNET UPDATE: Added address normalization to handle Cairo hex formats.
// ---------------------------------------------------------------------------
const getUserDisplayName = async (walletAddress) => {
  try {
    if (!walletAddress || walletAddress.startsWith('anon_')) {
      return 'Anonymous';
    }
    
    // Normalize Starknet address
    const normalizedAddress = walletAddress.toLowerCase();
    
    const user = await prisma.user.findUnique({ where: { walletAddress: normalizedAddress } });
    return user?.displayName
      || `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(normalizedAddress.length - 4)}`;
  } catch {
    return `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
  }
};

// ---------------------------------------------------------------------------
// GET /api/articles
// Returns only on-chain articles (public feed).
// ---------------------------------------------------------------------------
export const getAllArticles = async (req, res, next) => {
  try {
    const articles = await prisma.article.findMany({
      where: { onChain: true },
      orderBy: { createdAt: 'desc' },
      include: {
        comments: {
          where: { parentId: null },
          include: { replies: true },
        },
      },
    });
    res.json(articles);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/articles/all
// Returns ALL articles including pending (off-chain). Used by CuratedArticlesPage.
// ---------------------------------------------------------------------------
export const getAllArticlesIncludingPending = async (req, res, next) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        comments: {
          where: { parentId: null },
          include: { replies: true },
        },
      },
    });
    res.json(articles);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/articles/by-url?url=...
// Look up a single article by its original URL.
// ---------------------------------------------------------------------------
export const getArticleByUrl = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'url query parameter is required' });
    }

    const article = await prisma.article.findUnique({
      where: { articleUrl: url },
      include: {
        comments: {
          where: { parentId: null },
          include: { replies: true },
        },
      },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /api/articles/:id
// Single article with nested comments.
// ---------------------------------------------------------------------------
export const getArticleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('📖 Fetching article:', id);

    const article = await prisma.article.findUnique({
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

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    console.log(`✅ Article found, ${article.comments?.length ?? 0} top-level comments`);
    res.json(article);
  } catch (error) {
    console.error('getArticleById error:', error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/articles/scrape
// STEP 1 — Scrape URL and AI-summarize. Nothing is persisted yet.
// ---------------------------------------------------------------------------
export const scrapeAndSummarize = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Reject duplicate URLs early so the frontend can handle it gracefully.
    const existing = await prisma.article.findUnique({ where: { articleUrl: url } });
    if (existing) {
      return res.status(400).json({ error: 'Article already curated', article: existing });
    }

    console.log('🔍 Scraping:', url);
    const scrapedData = await scrapeArticle(url);

    console.log('🤖 Summarizing...');
    const summaryData = await summarizeArticle(scrapedData);

    res.status(200).json({
      message: 'Article scraped and summarized successfully',
      preview: {
        title: scrapedData.title,
        summary: summaryData.quickSummary,
        detailedSummary: summaryData.detailedAnalysis,
        condensedContent: summaryData.condensedContent,
        keyPoints: summaryData.keyTakeaways,
        statistics: summaryData.statistics,
        imageUrl: scrapedData.image,
        articleUrl: scrapedData.url,
        cardJson: summaryData.cardJson,
        author: scrapedData.author,
        publisher: scrapedData.publisher,
        date: scrapedData.date,
      },
    });
  } catch (error) {
    console.error('scrapeAndSummarize error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/articles/prepare
// STEP 2 — Persist the scraped preview to MongoDB with onChain: false.
// ---------------------------------------------------------------------------
export const prepareArticleForCuration = async (req, res, next) => {
  try {
    const {
      title,
      summary,
      detailedSummary,
      condensedContent,
      keyPoints,
      statistics,
      imageUrl,
      articleUrl,
      cardJson,
      author,
      publisher,
      date,
    } = req.body;

    if (!articleUrl || !title || !summary) {
      return res.status(400).json({ error: 'articleUrl, title and summary are required' });
    }

    // Return existing record instead of erroring so the frontend flow can resume.
    const existing = await prisma.article.findUnique({ where: { articleUrl } });
    if (existing) {
      return res.status(400).json({ error: 'Article already exists', article: existing });
    }

    console.log('💾 Saving article to database...');
    const article = await prisma.article.create({
      data: {
        title,
        summary,
        detailedSummary: detailedSummary || summary,
        fullContent: condensedContent || '',
        keyPoints: keyPoints || [],
        statistics: statistics || [],
        imageUrl: imageUrl || null,
        articleUrl,
        cardJson: cardJson || null,
        ipfsHash: null,
        onChain: false,
        upvotedBy: [],
      },
    });

    console.log('✅ Article saved:', article.id);
    res.json({ article, message: 'Article saved to database (blockchain pending)' });
  } catch (error) {
    console.error('prepareArticleForCuration error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/articles/upload-ipfs
// STEP 3a — Pin article metadata to IPFS via Pinata.
// ---------------------------------------------------------------------------
export const uploadArticleToIPFS = async (req, res, next) => {
  try {
    const articleData = req.body;

    if (!articleData || !articleData.title || !articleData.articleUrl) {
      return res.status(400).json({ error: 'Missing required article data (title, articleUrl)' });
    }

    console.log(`📤 Uploading "${articleData.title.substring(0, 40)}..." to IPFS`);
    const ipfsHash = await uploadToIPFS(articleData);
    console.log('✅ IPFS hash:', ipfsHash);

    // If the article already exists in the DB, update its ipfsHash.
    await prisma.article.updateMany({
      where: { articleUrl: articleData.articleUrl },
      data: { ipfsHash },
    });

    res.json({ ipfsHash });
  } catch (error) {
    console.error('uploadArticleToIPFS error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/articles/mark-onchain
// STEP 3b — Called AFTER the blockchain tx confirms.
// STARKNET UPDATE: Added transactionHash support and Address Normalization
// ---------------------------------------------------------------------------
export const markOnChain = async (req, res, next) => {
  try {
    const { articleUrl, articleId, onChainId, curator, ipfsHash, transactionHash } = req.body;

    if (!articleUrl || !articleId || !curator || !ipfsHash) {
      return res.status(400).json({
        error: 'articleUrl, articleId, curator and ipfsHash are all required',
      });
    }

    const normalizedCurator = curator.toLowerCase();
    const curatorName = await getUserDisplayName(normalizedCurator);

    const updated = await prisma.article.update({
      where: { id: articleId },  // DB ObjectId lookup
      data: {
        onChain: true,
        // ✅ FIX: Store the on-chain integer ID so comments can reference it
        articleId: onChainId ? parseInt(onChainId, 10) : null,
        curator: normalizedCurator,
        curatorName,
        ipfsHash,
        transactionHash: transactionHash || null,
      },
    });

    console.log(`⛓  Article marked on-chain. DB id: ${articleId}, on-chain id: ${onChainId}`);
    res.json(updated);
  } catch (error) {
    console.error('markOnChain error:', error.message);
    next(error);
  }
};
// ---------------------------------------------------------------------------
// POST /api/articles/upvote
// DB-level upvote (wallet-optional). Blockchain upvote is handled on-chain;
// STARKNET UPDATE: Normalizing user IDs (addresses) to prevent double voting.
// ---------------------------------------------------------------------------
export const upvoteArticle = async (req, res, next) => {
  try {
    const { articleId, userId } = req.body;

    if (!articleId || !userId) {
      return res.status(400).json({ error: 'articleId and userId are required' });
    }

    const normalizedUserId = userId.toLowerCase();

    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const upvotedByArray = Array.isArray(article.upvotedBy) ? article.upvotedBy : [];
    const hasUpvoted = upvotedByArray.some((vote) =>
      typeof vote === 'string' ? vote === normalizedUserId : vote.address === normalizedUserId
    );

    if (hasUpvoted) {
      return res.status(400).json({ error: 'Already upvoted this article' });
    }

    const displayName = await getUserDisplayName(normalizedUserId);
    const newUpvote = {
      address: normalizedUserId,
      name: displayName,
      timestamp: new Date().toISOString(),
    };

    const updated = await prisma.article.update({
      where: { id: articleId },
      data: {
        upvotes: { increment: 1 },
        upvotedBy: { push: newUpvote },
      },
    });

    res.json({ success: true, upvotes: updated.upvotes });
  } catch (error) {
    console.error('upvoteArticle error:', error.message);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /api/articles/sync-upvotes
// Overwrite the DB upvote count with the authoritative on-chain value.
// ---------------------------------------------------------------------------
export const syncUpvotes = async (req, res, next) => {
  try {
    const { articleUrl, upvotes } = req.body;

    if (!articleUrl || upvotes === undefined) {
      return res.status(400).json({ error: 'articleUrl and upvotes are required' });
    }

    const updated = await prisma.article.update({
      where: { articleUrl },
      data: { upvotes: parseInt(upvotes, 10) },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/articles/:id
// Remove a DB record. Blocked if the article is already on-chain.
// ---------------------------------------------------------------------------
export const deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    if (article.onChain) {
      return res.status(400).json({ error: 'Cannot delete an on-chain article' });
    }

    await prisma.article.delete({ where: { id } });
    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    next(error);
  }
};