import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extractHashtags } from '../utils/hashtags';
import { usePostStore } from './postStore';

interface HashtagState {
  trendingHashtags: { tag: string; count: number }[];
  recentHashtags: string[];
  followedHashtags: string[];
  
  // Actions
  updateTrendingHashtags: () => void;
  addRecentHashtag: (tag: string) => void;
  followHashtag: (tag: string) => void;
  unfollowHashtag: (tag: string) => void;
  clearRecentHashtags: () => void;
  
  // Queries
  isFollowingHashtag: (tag: string) => boolean;
  getPostsWithHashtag: (tag: string) => string[];
}

export const useHashtagStore = create<HashtagState>()(
  persist(
    (set, get) => ({
      trendingHashtags: [],
      recentHashtags: [],
      followedHashtags: [],

      updateTrendingHashtags: () => {
        const postStore = usePostStore.getState();
        const posts = postStore.getPosts();
        
        // Extract all content from posts
        const contents = posts.map(post => post.content);
        
        // Count hashtags
        const hashtagCounts = new Map<string, number>();
        
        contents.forEach(content => {
          const hashtags = extractHashtags(content);
          
          hashtags.forEach(tag => {
            const currentCount = hashtagCounts.get(tag) || 0;
            hashtagCounts.set(tag, currentCount + 1);
          });
        });
        
        // Convert map to array and sort by count
        const trending = Array.from(hashtagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20); // Limit to top 20
        
        set({ trendingHashtags: trending });
      },
      
      addRecentHashtag: (tag: string) => {
        // Format the tag (remove # if present and convert to lowercase)
        const formattedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
        
        set(state => {
          // Remove duplicates and add to the beginning
          const uniqueRecent = [
            formattedTag,
            ...state.recentHashtags.filter(t => t !== formattedTag)
          ].slice(0, 10); // Keep only 10 most recent
          
          return { recentHashtags: uniqueRecent };
        });
      },
      
      followHashtag: (tag: string) => {
        // Format the tag
        const formattedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
        
        // Add to followed hashtags if not already following
        set(state => {
          if (state.followedHashtags.includes(formattedTag)) {
            return state;
          }
          
          return { 
            followedHashtags: [...state.followedHashtags, formattedTag] 
          };
        });
      },
      
      unfollowHashtag: (tag: string) => {
        // Format the tag
        const formattedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
        
        // Remove from followed hashtags
        set(state => ({
          followedHashtags: state.followedHashtags.filter(t => t !== formattedTag)
        }));
      },
      
      clearRecentHashtags: () => {
        set({ recentHashtags: [] });
      },
      
      isFollowingHashtag: (tag: string) => {
        const formattedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
        return get().followedHashtags.includes(formattedTag);
      },
      
      getPostsWithHashtag: (tag: string) => {
        const formattedTag = tag.startsWith('#') ? tag.substring(1).toLowerCase() : tag.toLowerCase();
        const postStore = usePostStore.getState();
        const posts = postStore.getPosts();
        
        // Filter posts that contain the hashtag
        return posts
          .filter(post => {
            const hashtags = extractHashtags(post.content);
            return hashtags.includes(formattedTag);
          })
          .map(post => post.id);
      }
    }),
    {
      name: 'ipfs-x-hashtags-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        followedHashtags: state.followedHashtags,
        recentHashtags: state.recentHashtags
      })
    }
  )
); 