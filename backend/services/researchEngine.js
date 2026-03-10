import axios from 'axios';
import * as cheerio from 'cheerio';
import got from 'got';

// STARKNET ADDITION: Import Starknet hash utilities to anchor off-chain data
import { hash } from 'starknet';

/**
 * MULTI-SOURCE RESEARCH ENGINE v2.0
 * Searches across Web, Reddit, HackerNews, News, Academic, Dev.to, GitHub
 */

const SEARCH_PLATFORMS = {
  WEB: 'web',
  REDDIT: 'reddit',
  NEWS: 'news',
  ACADEMIC: 'academic',
  HACKERNEWS: 'hackernews',
  DEVTO: 'devto',
  GITHUB: 'github',
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function safeGot(url, opts = {}) {
  try {
    return await got(url, {
      headers: { 'User-Agent': USER_AGENT, ...opts.headers },
      timeout: { request: 12000 },
      followRedirect: true,
      https: { rejectUnauthorized: false },
      ...opts,
    });
  } catch {
    return { body: '' };
  }
}

async function safeAxios(url, opts = {}) {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: { 'User-Agent': USER_AGENT, ...opts.headers },
      ...opts,
    });
    return res.data;
  } catch {
    return null;
  }
}

// ─── SEARCH FUNCTIONS ─────────────────────────────────────────────────────────

async function searchWeb(topic, limit = 4) {
  try {
    const query = encodeURIComponent(topic);
    const response = await safeGot(
      `https://html.duckduckgo.com/html/?q=${query}`,
    );

    const $ = cheerio.load(response.body);
    const results = [];

    $('.result').each((i, elem) => {
      if (results.length >= limit) return false;

      const title = $(elem).find('.result__title').text().trim();
      const snippet = $(elem).find('.result__snippet').text().trim();
      let link = $(elem).find('a.result__url').attr('href');

      if (!link) {
        link = $(elem).find('.result__title a').attr('href');
      }

      if (link?.startsWith('//')) link = 'https:' + link;
      if (link?.includes('uddg=')) {
        try {
          const u = new URL(link);
          const actual = u.searchParams.get('uddg');
          if (actual) link = decodeURIComponent(actual);
        } catch {}
      }

      if (title && link?.startsWith('http')) {
        results.push({
          platform: SEARCH_PLATFORMS.WEB,
          title,
          url: link,
          snippet,
          relevanceScore: 0.85,
        });
      }
    });

    // Fallback: Bing scrape if DDG yields nothing
    if (results.length === 0) {
      const bingResp = await safeGot(
        `https://www.bing.com/search?q=${query}&count=${limit}`,
      );
      const $b = cheerio.load(bingResp.body);
      $b('.b_algo').each((i, elem) => {
        if (results.length >= limit) return false;
        const title = $b(elem).find('h2').text().trim();
        const link = $b(elem).find('h2 a').attr('href');
        const snippet = $b(elem).find('.b_caption p').text().trim();
        if (title && link?.startsWith('http')) {
          results.push({
            platform: SEARCH_PLATFORMS.WEB,
            title,
            url: link,
            snippet,
            relevanceScore: 0.82,
          });
        }
      });
    }

    console.log(`🌐 Web search: ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Web search error:', error.message);
    return [];
  }
}

async function searchReddit(topic, limit = 3) {
  try {
    const query = encodeURIComponent(topic);

    const urls = [
      `https://www.reddit.com/search.json?q=${query}&limit=${limit}&sort=relevance&type=link`,
      `https://www.reddit.com/search.json?q=${query}&limit=${limit}&sort=top&t=year&type=link`,
    ];

    const allPosts = [];

    for (const url of urls) {
      const data = await safeAxios(url, {
        headers: { 'User-Agent': 'WrapUp-Research/2.0' },
      });
      if (data?.data?.children) {
        for (const post of data.data.children) {
          const d = post.data;
          if (allPosts.length >= limit * 2) break;
          if (!d.title || !d.permalink) continue;

          allPosts.push({
            platform: SEARCH_PLATFORMS.REDDIT,
            title: d.title,
            url: `https://reddit.com${d.permalink}`,
            snippet: (d.selftext || '').substring(0, 300),
            content: d.selftext || '',
            author: d.author,
            subreddit: d.subreddit,
            score: d.score,
            numComments: d.num_comments,
            relevanceScore: 0.78,
          });
        }
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = allPosts.filter((p) => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    console.log(`🔴 Reddit search: ${unique.slice(0, limit).length} results`);
    return unique.slice(0, limit);
  } catch (error) {
    console.error('Reddit search error:', error.message);
    return [];
  }
}

async function searchHackerNews(topic, limit = 2) {
  try {
    const query = encodeURIComponent(topic);
    const data = await safeAxios(
      `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=${limit}`,
    );

    if (!data?.hits) return [];

    const results = data.hits
      .filter((h) => h.title && (h.url || h.objectID))
      .map((h) => ({
        platform: SEARCH_PLATFORMS.HACKERNEWS,
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        snippet: h.story_text
          ? h.story_text.substring(0, 300)
          : `${h.points} points, ${h.num_comments} comments on Hacker News`,
        content: h.story_text || '',
        author: h.author,
        score: h.points,
        relevanceScore: 0.88,
      }));

    console.log(`🟠 HackerNews: ${results.length} results`);
    return results;
  } catch (error) {
    console.error('HackerNews search error:', error.message);
    return [];
  }
}

async function searchNews(topic, limit = 3) {
  try {
    const results = [];
    const query = encodeURIComponent(topic);

    // Try NewsAPI if key is available
    if (process.env.NEWS_API_KEY) {
      const data = await safeAxios(
        `https://newsapi.org/v2/everything?q=${query}&sortBy=relevancy&pageSize=${limit}&language=en`,
        { headers: { 'X-Api-Key': process.env.NEWS_API_KEY } },
      );
      if (data?.articles) {
        for (const a of data.articles) {
          if (!a.title || !a.url) continue;
          results.push({
            platform: SEARCH_PLATFORMS.NEWS,
            title: a.title,
            url: a.url,
            snippet: a.description || '',
            content: a.content || a.description || '',
            author: a.author || a.source?.name,
            publisher: a.source?.name,
            relevanceScore: 0.9,
          });
        }
      }
    }

    // GNews API fallback
    if (results.length === 0 && process.env.GNEWS_API_KEY) {
      const data = await safeAxios(
        `https://gnews.io/api/v4/search?q=${query}&lang=en&max=${limit}&token=${process.env.GNEWS_API_KEY}`,
      );
      if (data?.articles) {
        for (const a of data.articles) {
          results.push({
            platform: SEARCH_PLATFORMS.NEWS,
            title: a.title,
            url: a.url,
            snippet: a.description || '',
            content: a.content || '',
            author: a.source?.name,
            relevanceScore: 0.88,
          });
        }
      }
    }

    // Google News RSS — always available as final fallback
    if (results.length < limit) {
      const rssResponse = await safeGot(
        `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
      );
      if (rssResponse.body) {
        const $ = cheerio.load(rssResponse.body, { xmlMode: true });
        $('item').each((i, elem) => {
          if (results.length >= limit) return false;
          const title = $(elem).find('title').text().trim();
          const link = $(elem).find('link').text().trim()
            || $(elem).find('guid').text().trim();
          const description = $(elem)
            .find('description')
            .text()
            .trim()
            .replace(/<[^>]*>/g, '')
            .substring(0, 250);
          const pubDate = $(elem).find('pubDate').text().trim();
          if (title && link?.startsWith('http')) {
            results.push({
              platform: SEARCH_PLATFORMS.NEWS,
              title,
              url: link,
              snippet: description,
              relevanceScore: 0.82,
              date: pubDate,
            });
          }
        });
      }
    }

    console.log(`📰 News search: ${results.length} results`);
    return results.slice(0, limit);
  } catch (error) {
    console.error('News search error:', error.message);
    return [];
  }
}

async function searchAcademic(topic, limit = 2) {
  try {
    const query = encodeURIComponent(topic.replace(/\s+/g, '+'));
    const response = await safeGot(
      `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=${limit}&sortBy=relevance`,
    );

    const $ = cheerio.load(response.body, { xmlMode: true });
    const results = [];

    $('entry').each((i, elem) => {
      const title = $(elem).find('title').text().trim();
      const summary = $(elem).find('summary').text().trim();
      const link = $(elem).find('id').text().trim();
      const published = $(elem).find('published').text().trim();
      const authors = [];
      $(elem)
        .find('author name')
        .each((j, a) => authors.push($(a).text().trim()));

      if (title) {
        results.push({
          platform: SEARCH_PLATFORMS.ACADEMIC,
          title,
          url: link,
          snippet: summary.substring(0, 300) + '...',
          content: summary,
          author: authors.slice(0, 3).join(', '),
          date: published,
          relevanceScore: 0.95,
        });
      }
    });

    console.log(`🎓 Academic search: ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Academic search error:', error.message);
    return [];
  }
}

async function searchDevTo(topic, limit = 2) {
  try {
    const query = encodeURIComponent(topic);
    const results = [];

    // Tag-based search
    const tagData = await safeAxios(
      `https://dev.to/api/articles?per_page=${limit}&tag=${encodeURIComponent(
        topic.split(' ')[0].toLowerCase(),
      )}`,
    );
    if (Array.isArray(tagData)) {
      for (const a of tagData.slice(0, limit)) {
        if (!a.title) continue;
        results.push({
          platform: SEARCH_PLATFORMS.DEVTO,
          title: a.title,
          url: a.url || `https://dev.to${a.path}`,
          snippet: a.description || '',
          content: a.description || '',
          author: a.user?.name || a.username,
          score: a.positive_reactions_count,
          relevanceScore: 0.75,
        });
      }
    }

    console.log(`💻 Dev.to search: ${results.length} results`);
    return results.slice(0, limit);
  } catch (error) {
    console.error('Dev.to search error:', error.message);
    return [];
  }
}

async function searchGitHub(topic, limit = 2) {
  try {
    const query = encodeURIComponent(topic);
    const headers = {};
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const data = await safeAxios(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`,
      { headers },
    );

    if (!data?.items) return [];

    const results = data.items.slice(0, limit).map((r) => ({
      platform: SEARCH_PLATFORMS.GITHUB,
      title: `${r.full_name}: ${r.description || r.name}`,
      url: r.html_url,
      snippet: r.description || '',
      content: `Repository: ${r.full_name}. ${r.description || ''}. Stars: ${r.stargazers_count}. Language: ${r.language || 'N/A'}. Topics: ${(r.topics || []).join(', ')}.`,
      author: r.owner?.login,
      score: r.stargazers_count,
      relevanceScore: 0.72,
    }));

    console.log(`🐙 GitHub search: ${results.length} results`);
    return results;
  } catch (error) {
    console.error('GitHub search error:', error.message);
    return [];
  }
}

// ─── RANKING ─────────────────────────────────────────────────────────────────

function rankSources(sources, topic) {
  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return sources
    .map((source) => {
      let score = source.relevanceScore || 0.5;
      const titleLower = (source.title || '').toLowerCase();
      const snippetLower = (source.snippet || '').toLowerCase();

      const titleMatches = topicWords.filter((w) =>
        titleLower.includes(w),
      ).length;
      score += (titleMatches / Math.max(topicWords.length, 1)) * 0.25;

      const snippetMatches = topicWords.filter((w) =>
        snippetLower.includes(w),
      ).length;
      score += (snippetMatches / Math.max(topicWords.length, 1)) * 0.1;

      if (source.platform === SEARCH_PLATFORMS.ACADEMIC) score += 0.2;
      if (source.platform === SEARCH_PLATFORMS.NEWS) score += 0.12;
      if (source.platform === SEARCH_PLATFORMS.HACKERNEWS) score += 0.1;
      if ((source.content || '').length > 500) score += 0.08;
      if ((source.score || 0) > 100) score += 0.05;

      return { ...source, finalScore: Math.min(score, 1.0) };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

// ─── CONTENT EXTRACTION ──────────────────────────────────────────────────────

async function extractSourceContent(source) {
  if ((source.content || '').length > 400) {
    return { ...source, extractedAt: new Date().toISOString() };
  }

  if (!source.url || source.url === '#') {
    return { ...source, content: source.snippet || '' };
  }

  try {
    const response = await safeGot(source.url);

    if (!response.body) {
      return { ...source, content: source.snippet || '' };
    }

    const $ = cheerio.load(response.body);

    $(
      'script, style, nav, header, footer, aside, iframe, .ad, [class*="advertisement"]',
    ).remove();

    const selectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.story-body',
      '.article-body',
      'main',
      '#content',
    ];

    let content = '';
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length > 0) {
        content = el.text().trim();
        if (content.length > 200) break;
      }
    }

    if (!content || content.length < 100) {
      let paragraphs = '';
      $('p').each((i, el) => {
        const t = $(el).text().trim();
        if (t.length > 40) paragraphs += t + '\n\n';
      });
      content = paragraphs || $('body').text().trim();
    }

    content = content.replace(/\s+/g, ' ').trim().substring(0, 6000);

    return { ...source, content, extractedAt: new Date().toISOString() };
  } catch {
    return { ...source, content: source.snippet || '', extractionError: true };
  }
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Main research orchestrator — called by researchController.js
 */
export async function conductMultiSourceResearch(topic, userContext = null) {
  try {
    console.log(`🔍 Multi-source search for: "${topic}"`);

    const searchPromises = [
      searchWeb(topic, 4),
      searchReddit(topic, 3),
      searchHackerNews(topic, 2),
      searchNews(topic, 3),
      searchAcademic(topic, 2),
      searchDevTo(topic, 2),
      searchGitHub(topic, 2),
    ];

    const results = await Promise.allSettled(searchPromises);

    const allSources = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .filter(Boolean);

    console.log(`📚 Raw sources collected: ${allSources.length}`);

    const rankedSources = rankSources(allSources, topic);
    const topSources = rankedSources.slice(0, 12);

    const sourcesWithContent = await Promise.all(
      topSources.map((source) => extractSourceContent(source)),
    );

    const validSources = sourcesWithContent.filter(
      (s) => s.content && s.content.length > 80,
    );

    // STARKNET ADDITION: Generate a Starknet-compatible Keccak hash of the research data.
    // This allows the backend to easily submit a cryptographic proof of this research to the Starknet contract.
    const researchPayloadString = JSON.stringify(validSources.map(s => s.url));
    const starknetReportHash = hash.starknetKeccak(researchPayloadString).toString();
    
    // Attach the hash to the array so the controller can access it easily without breaking existing mapping logic
    validSources.starknetHash = starknetReportHash;

    console.log(`✅ Final valid sources: ${validSources.length} (Starknet Hash Generated)`);
    return validSources;
  } catch (error) {
    console.error('Multi-source research error:', error.message);
    throw new Error('Failed to conduct research: ' + error.message);
  }
}