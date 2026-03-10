// backend/routes/leaderboardRoutes.js
import express from 'express';
import * as leaderboardController from '../controllers/leaderboardController.js';

const router = express.Router();

// Get top 5 articles for leaderboard
router.get('/top', leaderboardController.getTopArticles);

// Get leaderboard statistics
router.get('/stats', leaderboardController.getLeaderboardStats);

export default router;