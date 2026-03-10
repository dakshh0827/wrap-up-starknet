import Groq from 'groq-sdk';
import { scrapeArticle } from './scraper.js';
// STARKNET ADDITION: Import your Starknet provider to verify on-chain transactions
import { provider } from '../utils/starknetClient.js'; 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Scrape both articles and run AI comparison
 * STARKNET ADDITION: Added transactionHash to verify payment before spending AI credits
 */
export async function compareArticles(urlOne, urlTwo, transactionHash = null) {
  console.log(`🔬 Comparing:\n  [1] ${urlOne}\n  [2] ${urlTwo}`);

  // STARKNET: Verify the transaction on-chain before running expensive AI logic!
  if (transactionHash) {
    console.log(`🔗 Verifying Starknet Transaction: ${transactionHash}...`);
    try {
      const txReceipt = await provider.waitForTransaction(transactionHash);
      if (txReceipt.execution_status !== 'SUCCEEDED') {
        throw new Error("Starknet transaction failed or reverted.");
      }
      console.log(`✅ Starknet Transaction Verified!`);
    } catch (error) {
      console.error(`❌ Starknet Verification Failed:`, error.message);
      throw new Error("Invalid or failed Starknet transaction. AI Comparison aborted.");
    }
  }

  // Parallel scrape
  const [articleOne, articleTwo] = await Promise.all([
    scrapeArticle(urlOne),
    scrapeArticle(urlTwo),
  ]);

  console.log(`✅ Both articles scraped. Running AI comparison...`);

  const report = await runComparisonAnalysis(articleOne, articleTwo);

  return { articleOne, articleTwo, report };
}

async function runComparisonAnalysis(a1, a2) {
  const prompt = `You are an expert fact-checker and media analyst. Compare these two articles on every dimension listed below. Be specific, cite evidence from the content, and be impartial.

=== ARTICLE 1 ===
Title: ${a1.title}
Publisher: ${a1.publisher}
Author: ${a1.author}
URL: ${a1.url}
Date: ${a1.date}
Content (first 2500 chars): ${(a1.fullContent || a1.description || '').substring(0, 2500)}

=== ARTICLE 2 ===
Title: ${a2.title}
Publisher: ${a2.publisher}
Author: ${a2.author}
URL: ${a2.url}
Date: ${a2.date}
Content (first 2500 chars): ${(a2.fullContent || a2.description || '').substring(0, 2500)}

Respond ONLY with valid JSON matching this exact structure:
{
  "overview": {
    "article1": { "title": "...", "publisher": "...", "author": "...", "date": "...", "wordCountEstimate": 500 },
    "article2": { "title": "...", "publisher": "...", "author": "...", "date": "...", "wordCountEstimate": 400 }
  },
  "dimensions": {
    "credibility": {
      "article1Score": 7,
      "article2Score": 8,
      "article1Analysis": "Specific reasons for score...",
      "article2Analysis": "Specific reasons for score...",
      "winner": "article2",
      "explanation": "Why article2 wins this dimension"
    },
    "depth": {
      "article1Score": 6,
      "article2Score": 9,
      "article1Analysis": "...",
      "article2Analysis": "...",
      "winner": "article1",
      "explanation": "..."
    },
    "bias": {
      "article1Score": 6,
      "article2Score": 7,
      "article1Bias": "Slight left-leaning due to...",
      "article2Bias": "Mostly neutral with...",
      "article1Analysis": "...",
      "article2Analysis": "...",
      "winner": "article2",
      "explanation": "..."
    },
    "truthiness": {
      "article1Score": 8,
      "article2Score": 7,
      "article1Analysis": "Claims appear well-supported by...",
      "article2Analysis": "Some claims lack citation...",
      "winner": "article1",
      "explanation": "..."
    },
    "impact": {
      "article1Score": 7,
      "article2Score": 6,
      "article1Analysis": "...",
      "article2Analysis": "...",
      "winner": "article1",
      "explanation": "..."
    },
    "writingQuality": {
      "article1Score": 8,
      "article2Score": 7,
      "article1Analysis": "...",
      "article2Analysis": "...",
      "winner": "article1",
      "explanation": "..."
    },
    "publicPresence": {
      "article1Score": 5,
      "article2Score": 8,
      "article1Analysis": "Publisher's estimated reach...",
      "article2Analysis": "Publisher's estimated reach...",
      "winner": "article2",
      "explanation": "..."
    },
    "originality": {
      "article1Score": 9,
      "article2Score": 5,
      "article1Analysis": "Presents unique angle on...",
      "article2Analysis": "Largely rehashes mainstream...",
      "winner": "article1",
      "explanation": "..."
    }
  },
  "agreements": ["Both articles agree that...", "Both sources confirm..."],
  "disagreements": [
    { "topic": "Topic they disagree on", "article1Position": "...", "article2Position": "..." }
  ],
  "overallScores": {
    "article1Total": 56,
    "article2Total": 57,
    "article1Percentage": 70,
    "article2Percentage": 71
  },
  "verdict": {
    "winner": "article2",
    "shortVerdict": "Article 2 edges out with stronger sourcing and wider reach",
    "fullVerdict": "3-4 sentence detailed verdict explaining the comparison outcome...",
    "recommendation": "Read Article 1 for original analysis; Article 2 for broader context"
  },
  "keyDifferences": ["Key difference 1", "Key difference 2", "Key difference 3"],
  "factCheckNotes": ["Notable claim that needs verification", "Statistic cited without source"]
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are an expert fact-checker. Respond only with valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  return JSON.parse(completion.choices[0].message.content);
}