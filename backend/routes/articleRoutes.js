import express from 'express';
import * as articleController from '../controllers/articleController.js';

const router = express.Router();

// ===========================================================
// CRITICAL: Fixed-path routes MUST come before /:id
// ============================================================

// --- POST routes (no conflict with GET /:id regardless of order) ---
router.post('/scrape', articleController.scrapeAndSummarize);
router.post('/prepare', articleController.prepareArticleForCuration);
router.post('/upload-ipfs', articleController.uploadArticleToIPFS);
router.post('/mark-onchain', articleController.markOnChain);
router.post('/upvote', articleController.upvoteArticle);
router.post('/sync-upvotes', articleController.syncUpvotes);

// --- Fixed-path GET routes BEFORE parameterized GET /:id ---
router.get('/all', articleController.getAllArticlesIncludingPending);
router.get('/by-url', articleController.getArticleByUrl);          // ?url=...

// --- Parameterized routes LAST ---
router.get('/:id', articleController.getArticleById);
router.delete('/:id', articleController.deleteArticle);

export default router;