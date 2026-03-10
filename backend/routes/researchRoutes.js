import express from 'express';
import * as researchController from '../controllers/researchController.js';
import * as researchCommentController from '../controllers/researchCommentController.js';

const router = express.Router();

// ============================================================
// CRITICAL: All fixed-path routes MUST come before /:id
// Express matches routes top-to-bottom; /:id would swallow
// any path segment that comes after it if placed first.
// ============================================================
// ===== RESEARCH WRITE ENDPOINTS =====

router.post('/initiate', researchController.initiateResearch);
router.post('/generate', researchController.generateResearchReport);
router.post('/upload-ipfs', researchController.uploadResearchToIPFS);
router.post('/mark-onchain', researchController.markResearchOnChain);
router.post('/upvote', researchController.upvoteResearch);
router.post('/sync-upvotes', researchController.syncResearchUpvotes);

// ===== RESEARCH COMMENT ENDPOINTS =====
// These MUST be registered before GET /:id — otherwise Express
// captures "comments" as the :id param on GET /comments/...

router.post('/comments', researchCommentController.addResearchComment);
router.post('/comments/upload-ipfs', researchCommentController.uploadResearchCommentToIPFS);
router.post('/comments/mark-onchain', researchCommentController.markResearchCommentOnChain);
router.get('/comments/by-research', researchCommentController.getResearchComments);
router.get('/comments/:commentId/replies', researchCommentController.getResearchCommentReplies);
router.post('/comments/upvote', researchCommentController.upvoteResearchComment);
router.post('/comments/sync-upvotes', researchCommentController.syncResearchCommentUpvotes);

// ===== RESEARCH READ ENDPOINTS =====
// GET / (list) must come before GET /:id
router.get('/', researchController.getAllResearch);
router.get('/:id', researchController.getResearchById);
router.delete('/:id', researchController.deleteResearch);

export default router;