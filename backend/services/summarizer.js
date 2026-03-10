import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Summarize article/post using Groq with concise format
 * @param {Object} articleData - Article/post metadata from scraper
 * @returns {Promise<Object>} Structured summary with stats and key takeaways
 */
export async function summarizeArticle(articleData) {
  try {
    const contentType = articleData.platform === 'linkedin' ? 'LinkedIn post' : 
                       articleData.platform === 'twitter' ? 'Twitter/X post' : 
                       'article';
    
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a professional content analyzer. Create a structured summary with these components:
1. Quick Summary (50-80 words) - concise overview
2. Statistics - extract any numbers, percentages, or data points mentioned
3. Detailed Analysis (200-300 words) - comprehensive insights and context
4. Key Takeaways - 3-5 actionable bullet points
5. Condensed Content (300-350 words) - A brief, readable summary of the full content that captures main points WITHOUT being the full article

CRITICAL: The "condensedContent" must be significantly shorter than the original - focus on main ideas only.

Respond ONLY with valid JSON.`
        },
        {
          role: "user",
          content: `Analyze this ${contentType}:

Title: ${articleData.title}
Author: ${articleData.author}
Content: ${articleData.fullContent || articleData.description}

Provide response in JSON format:
{
  "quickSummary": "50-80 word overview here",
  "statistics": [
    {"label": "metric name", "value": "number/percentage", "context": "brief context"}
  ],
  "detailedAnalysis": "200-300 word comprehensive analysis",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "condensedContent": "100-150 word brief summary of the full content focusing on main points only"
}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);
    
    // Ensure condensed content is actually shorter
    const originalLength = (articleData.fullContent || articleData.description).length;
    const condensedLength = (analysis.condensedContent || '').length;
    
    // If condensed content is too long (more than 30% of original), truncate it
    if (condensedLength > originalLength * 0.3) {
      const sentences = analysis.condensedContent.split('. ');
      const targetLength = Math.floor(originalLength * 0.25);
      let truncated = '';
      
      for (const sentence of sentences) {
        if ((truncated + sentence).length < targetLength) {
          truncated += sentence + '. ';
        } else {
          break;
        }
      }
      
      analysis.condensedContent = truncated.trim() || analysis.quickSummary;
    }
    
    const cardJson = JSON.stringify({
      headline: articleData.title,
      quickSummary: analysis.quickSummary,
      statistics: analysis.statistics || [],
      detailedAnalysis: analysis.detailedAnalysis,
      keyTakeaways: analysis.keyTakeaways || [],
      condensedContent: analysis.condensedContent,
      source: articleData.publisher,
      author: articleData.author,
      publishedAt: articleData.date,
      imageUrl: articleData.image,
      images: articleData.images || [],
      platform: articleData.platform || 'article'
    });
    
    console.log(`✓ Summarized: "${articleData.title.substring(0, 50)}..."`);
    console.log(`  Original: ${originalLength} chars → Condensed: ${analysis.condensedContent.length} chars`);
    
    return {
      quickSummary: analysis.quickSummary,
      statistics: analysis.statistics || [],
      detailedAnalysis: analysis.detailedAnalysis,
      keyTakeaways: analysis.keyTakeaways || [],
      condensedContent: analysis.condensedContent,
      cardJson
    };
  } catch (error) {
    console.error('Groq Summarization error:', error.message);
    
    // Fallback: create manual condensed summary
    const originalText = articleData.fullContent || articleData.description || '';
    const words = originalText.split(' ');
    
    const fallbackQuick = words.slice(0, 80).join(' ') + (words.length > 80 ? '...' : '');
    const fallbackDetailed = words.slice(0, 250).join(' ') + (words.length > 250 ? '...' : '');
    const fallbackCondensed = words.slice(0, 150).join(' ') + (words.length > 150 ? '...' : '');
    
    return {
      quickSummary: fallbackQuick,
      statistics: [],
      detailedAnalysis: fallbackDetailed,
      keyTakeaways: ['Content analysis unavailable', 'Please review original article'],
      condensedContent: fallbackCondensed,
      cardJson: JSON.stringify({
        headline: articleData.title,
        quickSummary: fallbackQuick,
        statistics: [],
        detailedAnalysis: fallbackDetailed,
        keyTakeaways: ['Content analysis unavailable'],
        condensedContent: fallbackCondensed,
        source: articleData.publisher,
        author: articleData.author,
        publishedAt: articleData.date,
        imageUrl: articleData.image,
        images: articleData.images || [],
        platform: articleData.platform || 'article'
      })
    };
  }
}

/**
 * Quick extraction for simple content types (tweets, short posts)
 * @param {Object} contentData - Content from scraper
 * @returns {Promise<Object>} Simplified summary
 */
export async function quickSummarize(contentData) {
  const content = contentData.fullContent || contentData.description;
  
  // For short content (< 500 chars), return structured version without AI
  if (content.length < 500) {
    const condensed = content.substring(0, 200) + (content.length > 200 ? '...' : '');
    
    return {
      quickSummary: condensed,
      statistics: [],
      detailedAnalysis: content,
      keyTakeaways: ['See original post for full context'],
      condensedContent: condensed,
      cardJson: JSON.stringify({
        headline: contentData.title,
        quickSummary: condensed,
        statistics: [],
        detailedAnalysis: content,
        keyTakeaways: [],
        condensedContent: condensed,
        source: contentData.publisher,
        author: contentData.author,
        publishedAt: contentData.date,
        imageUrl: contentData.image,
        images: contentData.images || [],
        platform: contentData.platform || 'post'
      })
    };
  }
  
  // For longer content, use full summarization
  return summarizeArticle(contentData);
}