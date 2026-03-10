import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// ============================================================
// CRITICAL: Fixed-path routes MUST come before /:walletAddress
// POST routes are safe regardless since methods differ,
// but kept in logical order for clarity.
// ===========================================================

// --- POST routes (no conflict with GET /:walletAddress) ---
router.post('/set-display-name', userController.setDisplayName);
router.post('/get-or-create', userController.getOrCreateUser);

// --- Parameterized GET route LAST ---
router.get('/:walletAddress', userController.getUserByWallet);

export default router;