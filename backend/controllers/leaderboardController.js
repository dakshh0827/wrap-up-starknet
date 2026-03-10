// backend/controllers/leaderboardController.js

import { PrismaClient } from '@prisma/client';
// STARKNET ADDITION: Ready for live on-chain data verification
import { RpcProvider, Contract } from 'starknet';

const prisma = new PrismaClient();

// STARKNET HELPER: Configure local Devnet provider (Matches Phase 1 & 2)
const starknetProvider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050" });
const WRAPUP_CONTRACT_ADDRESS = "0x062d8ad178f37a55031c775a9597a82adf0aa9ea428bfefb33f98c49e530d6f9";

/**
 * Calculate leaderboard score for an article
 * Formula: (comments * 0.6) + (upvotes * 0.4)
 * @param {number} comments - Number of comments
 * @param {number} upvotes - Number of upvotes
 * @returns {number} - Calculated score
 */
const calculateScore = (comments, upvotes) => {
  const commentWeight = 0.6;
  const upvoteWeight = 0.4;
  return (comments * commentWeight) + (upvotes * upvoteWeight);
};

/**
 * Get top 5 articles for leaderboard
 * Only includes articles that are on-chain
 * Ranking based on: 60% comments + 40% upvotes
 */
export const getTopArticles = async (req, res, next) => {
  try {
    console.log('📊 Fetching Starknet leaderboard data...');
    
    // Fetch all on-chain articles with their comments
    const articles = await prisma.article.findMany({
      where: { 
        onChain: true 
      },
      include: { 
        comments: {
          where: { parentId: null }, // Only count top-level comments
          select: { id: true } // Only need count
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!articles || articles.length === 0) {
      console.log('⚠️ No on-chain Starknet articles found');
      return res.json([]);
    }

    // Calculate score for each article
    const articlesWithScores = articles.map(article => {
      const commentCount = article.comments?.length || 0;
      const upvoteCount = article.upvotes || 0;
      const score = calculateScore(commentCount, upvoteCount);

      return {
        id: article.id,
        title: article.title,
        summary: article.summary,
        imageUrl: article.imageUrl,
        articleUrl: article.articleUrl,
        curator: article.curator, // This is now a Starknet address (0x...)
        curatorName: article.curatorName,
        articleId: article.articleId,
        upvotes: upvoteCount,
        commentCount: commentCount,
        score: parseFloat(score.toFixed(2)), // Round to 2 decimal places
        createdAt: article.createdAt,
        transactionHash: article.transactionHash // Exposing the Starknet Tx Hash if stored
      };
    });

    // Filter out articles with 0 score and sort by score (descending)
    const sortedArticles = articlesWithScores
      .filter(article => article.score > 0)
      .sort((a, b) => b.score - a.score);

    // Get top 5
    const topArticles = sortedArticles.slice(0, 5);

    console.log(`✅ Leaderboard: ${topArticles.length} Starknet articles found`);
    
    // Add rank to each article
    const leaderboard = topArticles.map((article, index) => ({
      ...article,
      rank: index + 1
    }));

    res.json(leaderboard);
    
  } catch (error) {
    console.error('❌ Leaderboard fetch error:', error);
    next(error);
  }
};

/**
 * Get leaderboard statistics
 * Provides aggregate data about the leaderboard
 */
export const getLeaderboardStats = async (req, res, next) => {
  try {
    const totalOnChainArticles = await prisma.article.count({
      where: { onChain: true }
    });

    const articlesWithActivity = await prisma.article.count({
      where: {
        onChain: true,
        OR: [
          { upvotes: { gt: 0 } },
          { comments: { some: {} } }
        ]
      }
    });

    const totalUpvotes = await prisma.article.aggregate({
      where: { onChain: true },
      _sum: { upvotes: true }
    });

    const totalComments = await prisma.comment.count({
      where: {
        onChain: true,
        parentId: null
      }
    });

    res.json({
      totalOnChainArticles,
      articlesWithActivity,
      totalUpvotes: totalUpvotes._sum.upvotes || 0,
      totalComments
    });

  } catch (error) {
    console.error('❌ Stats fetch error:', error);
    next(error);
  }
};