/**
 * Utility functions for handling hashtags in post content
 */

/**
 * Extract hashtags from text content
 * @param content Text content to extract hashtags from
 * @returns Array of unique hashtags without the # symbol
 */
export const extractHashtags = (content: string): string[] => {
  if (!content || typeof content !== 'string') return [];
  
  // Match hashtags with various Unicode character support
  // This regex matches:
  // - A # character
  // - Followed by at least one character that is a letter, number, or underscore
  // - Supports Unicode characters for international languages
  // - Excludes punctuation and special characters that would end a hashtag
  const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
  
  const matches = content.match(hashtagRegex) || [];
  
  // Remove the # prefix and convert to lowercase
  const hashtags = matches.map(tag => tag.substring(1).toLowerCase());
  
  // Remove duplicates
  return [...new Set(hashtags)];
};

/**
 * Format hashtags to ensure they are valid
 * @param tag Hashtag to format
 * @returns Formatted hashtag without # prefix
 */
export const formatHashtag = (tag: string): string => {
  if (!tag) return '';
  
  // Remove # if present
  let formatted = tag.startsWith('#') ? tag.substring(1) : tag;
  
  // Remove spaces and special characters
  formatted = formatted.replace(/[^\p{L}\p{N}_]/gu, '');
  
  // Convert to lowercase
  return formatted.toLowerCase();
};

/**
 * Add hashtag to content if not already present
 * @param content Current content text
 * @param hashtag Hashtag to add (with or without #)
 * @returns Updated content with hashtag added
 */
export const addHashtagToContent = (content: string, hashtag: string): string => {
  if (!content || !hashtag) return content;
  
  // Format the hashtag
  const formattedTag = formatHashtag(hashtag);
  if (!formattedTag) return content;
  
  // Check if hashtag already exists in content
  const existingTags = extractHashtags(content);
  if (existingTags.includes(formattedTag)) return content;
  
  // Add the hashtag to the end with a space
  return `${content} #${formattedTag}`;
};

/**
 * Convert hashtags to clickable links in HTML
 * @param content Text content with hashtags
 * @returns HTML with hashtags converted to links
 */
export const linkifyHashtags = (content: string): string => {
  if (!content) return '';
  
  // Replace hashtags with links
  return content.replace(
    /#([\p{L}\p{N}_]+)/gu, 
    '<a href="/hashtag/$1" class="text-primary hover:underline">#$1</a>'
  );
};

/**
 * Get trending hashtags from an array of contents
 * @param contents Array of text contents to analyze
 * @param limit Maximum number of trending hashtags to return
 * @returns Array of trending hashtags with counts
 */
export const getTrendingHashtags = (
  contents: string[], 
  limit: number = 10
): Array<{tag: string, count: number}> => {
  if (!contents || !contents.length) return [];
  
  // Extract all hashtags from all contents
  const allHashtags = contents.flatMap(content => extractHashtags(content));
  
  // Count occurrences of each hashtag
  const hashtagCounts = allHashtags.reduce((counts, tag) => {
    counts[tag] = (counts[tag] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  // Convert to array and sort by count (descending)
  const sortedHashtags = Object.entries(hashtagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  
  // Return limited number of hashtags
  return sortedHashtags.slice(0, limit);
}; 