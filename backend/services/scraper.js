import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperImage from 'metascraper-image';
import metascraperLogo from 'metascraper-logo';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';
import got from 'got';
import * as cheerio from 'cheerio';

const scraper = metascraper([
  metascraperAuthor(),
  metascraperDate(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperPublisher(),
  metascraperTitle(),
  metascraperUrl()
]);

// Default platform images as data URIs
const DEFAULT_IMAGES = {
  linkedin: '/linkedin_fallback.png',
  
  twitter: 'x_fallback.png'
};

/**
 * Detect platform from URL
 * @param {string} url - URL to analyze
 * @returns {string} Platform identifier
 */
function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  return 'article';
}

/**
 * Check if an image URL is likely a profile/avatar image
 * @param {string} src - Image source URL
 * @param {Object} elem - Cheerio element
 * @returns {boolean} True if it's likely a profile image
 */
function isProfileImage(src, elem = null) {
  const srcLower = src.toLowerCase();
  
  // Check URL patterns
  const profilePatterns = [
    'profile',
    'avatar',
    'user',
    '/p/',
    'profile_image',
    'profile-photo',
    'headshot',
    'pfp'
  ];
  
  if (profilePatterns.some(pattern => srcLower.includes(pattern))) {
    return true;
  }
  
  // Check for small dimensions in URL (profile pics are often small)
  const sizeMatch = src.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1]);
    const height = parseInt(sizeMatch[2]);
    if (width <= 200 && height <= 200) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract LinkedIn post content
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} Extracted content
 */
function extractLinkedInPost($) {
  const content = {
    text: '',
    images: [],
    author: '',
    authorTitle: '',
    timestamp: ''
  };

  // Extract post text
  const textSelectors = [
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '[data-test-id="main-feed-activity-card__commentary"]',
    '.update-components-text',
    'span[dir="ltr"]'
  ];

  for (const selector of textSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.text = element.text().trim();
      if (content.text) break;
    }
  }

  // Extract images - focus on post content images only
  const imageSelectors = [
    '.feed-shared-image__container img',
    '.feed-shared-image__image-link img',
    '.update-components-image img',
    '.feed-shared-article__image img',
    '.feed-shared-external-video__image img',
    '[data-test-id="feed-images-content"] img',
    'article .content-image img'
  ];

  const seenImages = new Set();
  
  imageSelectors.forEach(selector => {
    $(selector).each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-delayed-url');
      
      if (!src || seenImages.has(src)) return;
      
      // Skip data URIs, profile images, and icons
      if (src.includes('data:image') || 
          isProfileImage(src, elem) ||
          src.includes('icon') ||
          src.includes('logo') ||
          src.includes('emoji') ||
          $(elem).hasClass('presence-entity__image') ||
          $(elem).hasClass('profile-photo') ||
          $(elem).hasClass('EntityPhoto')) {
        return;
      }
      
      // Check if image is within post content area (not in header/footer)
      const parent = $(elem).closest('.feed-shared-update-v2, article, .feed-shared-content');
      if (parent.length > 0) {
        seenImages.add(src);
        content.images.push(src);
      }
    });
  });

  // Extract author info
  const authorSelectors = [
    '.update-components-actor__name',
    '.feed-shared-actor__name',
    '[data-control-name="actor"] span'
  ];

  for (const selector of authorSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.author = element.text().trim();
      if (content.author) break;
    }
  }

  // Extract author title/subtitle
  const titleSelectors = [
    '.update-components-actor__description',
    '.feed-shared-actor__description'
  ];

  for (const selector of titleSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.authorTitle = element.text().trim();
      if (content.authorTitle) break;
    }
  }

  // Extract timestamp
  const timeSelectors = [
    'time',
    '.feed-shared-actor__sub-description time',
    '[data-test-id="now-timestamp"]'
  ];

  for (const selector of timeSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.timestamp = $(element).attr('datetime') || $(element).text().trim();
      if (content.timestamp) break;
    }
  }

  return content;
}

/**
 * Extract Twitter/X post content
 * @param {CheerioAPI} $ - Cheerio instance
 * @returns {Object} Extracted content
 */
function extractTwitterPost($) {
  const content = {
    text: '',
    images: [],
    author: '',
    handle: '',
    timestamp: ''
  };

  // Extract tweet text
  const textSelectors = [
    '[data-testid="tweetText"]',
    '.tweet-text',
    '[lang] span',
    'div[dir="auto"]'
  ];

  for (const selector of textSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      let fullText = '';
      elements.each((i, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length > fullText.length) {
          fullText = text;
        }
      });
      if (fullText) {
        content.text = fullText;
        break;
      }
    }
  }

  // Extract images - focus on tweet media only
  const imageSelectors = [
    '[data-testid="tweetPhoto"] img',
    '[data-testid="card.layoutLarge.media"] img',
    '.media-img img',
    'div[aria-labelledby*="image"] img',
    '[role="link"] img[alt*="Image"]'
  ];

  const seenImages = new Set();
  
  imageSelectors.forEach(selector => {
    $(selector).each((i, elem) => {
      const src = $(elem).attr('src');
      
      if (!src || seenImages.has(src)) return;
      
      // Skip profile images, emojis, and small images
      if (isProfileImage(src, elem) ||
          src.includes('profile_images') ||
          src.includes('emoji') ||
          src.includes('icon') ||
          src.includes('badge') ||
          src.includes('default_profile') ||
          src.includes('twimg.com/profile') ||
          $(elem).hasClass('avatar') ||
          $(elem).hasClass('profile-img')) {
        return;
      }
      
      // Only include images from media containers
      const mediaContainer = $(elem).closest('[data-testid="tweetPhoto"], .media, [role="link"]');
      if (mediaContainer.length > 0 && src.includes('media')) {
        seenImages.add(src);
        content.images.push(src);
      }
    });
  });

  // Extract author name
  const authorSelectors = [
    '[data-testid="User-Name"] span',
    '.profile-name',
    '[role="link"] span'
  ];

  for (const selector of authorSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.author = element.text().trim();
      if (content.author && !content.author.startsWith('@')) break;
    }
  }

  // Extract handle
  $('a[href*="/"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && href.startsWith('/') && !href.includes('/status/')) {
      const handle = href.split('/')[1];
      if (handle && handle.startsWith('@') === false) {
        content.handle = '@' + handle;
        return false;
      }
    }
  });

  // Extract timestamp
  const timeSelectors = [
    'time',
    '[data-testid="timestampLink"] time',
    'a[href*="/status/"] time'
  ];

  for (const selector of timeSelectors) {
    const element = $(selector).first();
    if (element.length > 0) {
      content.timestamp = $(element).attr('datetime') || $(element).text().trim();
      if (content.timestamp) break;
    }
  }

  return content;
}

/**
 * Extract main article content from HTML
 * @param {string} html - Raw HTML
 * @returns {string} Extracted text content
 */
function extractArticleContent(html) {
  try {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    const unwantedSelectors = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'ads', '.ad', '#ad'];
    unwantedSelectors.forEach(selector => {
      $(selector).remove();
    });
    
    // Try to find main content area
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      'main',
      '#content'
    ];
    
    let contentElement = null;
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        contentElement = element;
        break;
      }
    }
    
    // Fallback to body if no specific content area found
    if (!contentElement) {
      contentElement = $('body');
    }
    
    // Extract text with paragraph breaks
    let fullText = '';
    
    contentElement.find('p, h1, h2, h3, h4, h5, h6, li').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 20) {
        fullText += text + '\n\n';
      }
    });
    
    return fullText.trim();
  } catch (error) {
    console.error('Content extraction error:', error.message);
    return '';
  }
}

/**
 * Scrape article metadata and full content from URL
 * @param {string} targetUrl - The URL to scrape
 * @returns {Promise<Object>} Scraped metadata and content
 */
export async function scrapeArticle(targetUrl) {
  try {
    const platform = detectPlatform(targetUrl);
    
    const { body: html, url } = await got(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,/;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      timeout: {
        request: 15000
      },
      retry: {
        limit: 2
      },
      followRedirect: true,
      https: {
        rejectUnauthorized: false
      }
    });
    
    const $ = cheerio.load(html);
    let result;

    if (platform === 'linkedin') {
      const linkedInData = extractLinkedInPost($);
      const metadata = await scraper({ html, url });
      
      result = {
        platform: 'linkedin',
        title: linkedInData.text.substring(0, 100) + '...',
        description: linkedInData.text,
        fullContent: linkedInData.text,
        images: linkedInData.images,
        // Always use default LinkedIn image for social posts
        image: DEFAULT_IMAGES.linkedin,
        author: linkedInData.author || metadata.author || 'LinkedIn User',
        authorTitle: linkedInData.authorTitle || '',
        publisher: 'LinkedIn',
        date: linkedInData.timestamp || metadata.date || new Date().toISOString(),
        url: metadata.url || targetUrl,
        logo: metadata.logo || null
      };
    } else if (platform === 'twitter') {
      const twitterData = extractTwitterPost($);
      const metadata = await scraper({ html, url });
      
      result = {
        platform: 'twitter',
        title: twitterData.text.substring(0, 100) + '...',
        description: twitterData.text,
        fullContent: twitterData.text,
        images: twitterData.images,
        // Always use default X/Twitter image for social posts
        image: DEFAULT_IMAGES.twitter,
        author: twitterData.author || metadata.author || 'Twitter User',
        handle: twitterData.handle || '',
        publisher: 'X (formerly Twitter)',
        date: twitterData.timestamp || metadata.date || new Date().toISOString(),
        url: metadata.url || targetUrl,
        logo: metadata.logo || null
      };
    } else {
      // Standard article scraping
      const metadata = await scraper({ html, url });
      const fullContent = extractArticleContent(html);
      
      result = {
        platform: 'article',
        title: metadata.title || 'Untitled',
        description: metadata.description || '',
        fullContent: fullContent || metadata.description || '',
        image: metadata.image || null,
        images: [metadata.image].filter(Boolean),
        author: metadata.author || 'Unknown',
        publisher: metadata.publisher || new URL(targetUrl).hostname,
        date: metadata.date || new Date().toISOString(),
        url: metadata.url || targetUrl,
        logo: metadata.logo || null
      };
    }
    
    console.log(`✓ Scraped ${platform}: ${result.title.substring(0, 50)}...`);
    return result;
    
  } catch (error) {
    console.error('Scraping error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      throw new Error('Invalid URL or domain not found');
    } else if (error.response?.statusCode === 403) {
      throw new Error('Access forbidden - website blocking scraping');
    } else if (error.response?.statusCode === 404) {
      throw new Error('Content not found (404)');
    } else if (error.name === 'TimeoutError') {
      throw new Error('Request timeout - website too slow');
    } else {
      throw new Error(`Failed to scrape URL: ${error.message}`);
    }
  }
}