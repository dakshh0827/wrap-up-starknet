// backend/routes/commentRoutes.js
import express from 'express';
import {
  addComment,
  uploadCommentToIPFS,
  markCommentOnChain,
  upvoteComment,
  syncCommentUpvotes,
  getCommentsByArticleUrl,
  getCommentReplies
} from '../controllers/commentController.js';

const router = express.Router();

router.post('/', addComment);
router.post('/upload-ipfs', uploadCommentToIPFS);
router.post('/mark-onchain', markCommentOnChain);
router.post('/upvote', upvoteComment);
router.post('/sync-upvotes', syncCommentUpvotes);
router.get('/by-article', getCommentsByArticleUrl);
router.get('/:commentId/replies', getCommentReplies);

export default router;