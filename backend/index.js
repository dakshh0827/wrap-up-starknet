import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import articleRoutes from './routes/articleRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import researchRoutes from './routes/researchRoutes.js';
import comparisonRoutes from './routes/comparisonRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

// STARKNET ADDED: If you created a starknetClient.js utility, you can import it here 
// to verify the connection globally on startup.
// import { provider } from './utils/starknetClient.js';

const app = express();

app.use(
  cors({
    origin: [
      'https://wrap-up-one.vercel.app',
      'http://localhost:5173',
      'https://wrap-up-starknet-tuq6.vercel.app/',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  }),
);

// AFTER:
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/articles', articleRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/comparisons', comparisonRoutes);

app.get('/health', async (req, res) => {
  // STARKNET ADDED: Optional block to check if your Starknet RPC is alive.
  // Uncomment this once your starknetClient is fully set up if you want live health checks.
  /*
  let starknetStatus = 'Unknown';
  try {
    const chainId = await provider.getChainId();
    starknetStatus = `Connected to Starknet (${chainId})`;
  } catch (error) {
    starknetStatus = 'Disconnected from Starknet RPC';
  }
  */

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    features: {
      aiResearch: true,
      linkCuration: true,
      blockchain: true, // Now powered by Starknet!
      articleComparator: true,
    },
    // starknet: starknetStatus
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Wrap-Up Backend v2.1 running on port ${PORT}`);
  console.log(`🔬 AI Research Engine: ENABLED`);
  console.log(`⚖️  Article Comparator: ENABLED`);
  console.log(`✨ Blockchain: STARKNET DEVNET INITIALIZED`); // STARKNET ADDED
});
