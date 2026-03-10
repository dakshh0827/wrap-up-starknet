import express from 'express';
import * as comparisonController from '../controllers/comparisonController.js';

const router = express.Router();

// ============================================================
// CRITICAL: Fixed-path routes MUST come before /:id
// ===========================================================

// --- POST routes ---
router.post('/generate', comparisonController.generateComparison);
router.post('/upload-ipfs', comparisonController.uploadComparisonToIPFS);
router.post('/mark-onchain', comparisonController.markComparisonOnChain);
router.post('/upvote', comparisonController.upvoteComparison);

// --- Fixed-path GET routes BEFORE /:id ---
router.get('/', comparisonController.getAllComparisons);

// --- Parameterized routes LAST ---
router.get('/:id', comparisonController.getComparisonById);
router.delete('/:id', comparisonController.deleteComparison);

export default router;