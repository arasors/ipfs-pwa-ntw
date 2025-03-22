import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Post, Comment, PostVisibility } from '@/models/Post';
import { useUserStore } from '@/store/userStore';
import { useNotificationStore } from './notificationStore';

export interface PostState {
  posts: Post[];
  loading: boolean;
  addPost: (post: Omit<Post, 'id'>) => void;
  removePost: (id: string) => void;
  updatePost: (id: string, updates: Partial<Post>) => void;
  likePost: (postId: string) => void;
  addComment: (postId: string, comment: Comment) => void;
  removeComment: (postId: string, commentId: string) => void;
  updateComment: (postId: string, commentId: string, updates: Partial<Comment>) => void;
  likeComment: (postId: string, commentId: string) => void;
  getPosts: () => Post[];
  getPost: (id: string) => Post | undefined;
  getUserPosts: (address: string) => Post[];
  getVisiblePosts: () => Post[];
  updatePostVisibility: (postId: string, visibility: PostVisibility) => void;
  canViewPost: (post: Post) => boolean;
  reset: () => void;
}

export const usePostStore = create<PostState>()(
  persist(
    (set, get) => ({
      posts: [],
      loading: false,
      addPost: (post) => {
        const newPost: Post = {
          id: uuidv4(),
          ...post,
          likes: 0,
          comments: [],
          reposts: 0,
          visibility: post.visibility || 'public', // Default to public if not specified
        };
        console.log("Adding new post to store:", newPost);
        set((state) => ({ posts: [newPost, ...state.posts] }));
        return newPost;
      },
      removePost: (id) => set((state) => ({
        posts: state.posts.filter((post) => post.id !== id)
      })),
      updatePost: (id, updates) => set((state) => ({
        posts: state.posts.map((post) =>
          post.id === id ? { ...post, ...updates } : post
        )
      })),
      likePost: (postId) => {
        const post = get().getPost(postId);
        if (!post || !get().canViewPost(post)) return;
        
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId ? { ...post, likes: post.likes + 1 } : post
          ),
        }));
        
        // Create notification
        if (post) {
          const currentUserAddress = localStorage.getItem('walletAddress');
          // Create notification if not liking own post
          if (post.authorAddress !== currentUserAddress) {
            const notificationStore = useNotificationStore.getState();
            notificationStore.addNotification({
              type: 'like',
              title: 'New Like',
              message: `${currentUserAddress || 'A user'} liked your post`,
              actorAddress: currentUserAddress || undefined,
              recipientAddress: post.authorAddress,
              postId: post.id,
              postContentCID: post.contentCID
            });
          }
        }
      },
      addComment: (postId, comment) => {
        const post = get().getPost(postId);
        if (!post || !get().canViewPost(post)) return;
        
        const commentWithPrivacy = {
          ...comment,
          parentPostVisibility: post.visibility, // Inherit visibility from parent post
        };
        
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? { ...post, comments: [...post.comments, commentWithPrivacy] }
              : post
          ),
        }));
        
        // Create notification
        if (post) {
          const currentUserAddress = localStorage.getItem('walletAddress');
          // Create notification if not commenting on own post
          if (post.authorAddress !== currentUserAddress) {
            const notificationStore = useNotificationStore.getState();
            notificationStore.addNotification({
              type: 'comment',
              title: 'New Comment',
              message: `${comment.authorName || comment.authorAddress} commented on your post: ${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}`,
              actorAddress: comment.authorAddress,
              actorName: comment.authorName,
              recipientAddress: post.authorAddress,
              postId: post.id,
              commentId: comment.id,
              postContentCID: post.contentCID
            });
          }
        }
      },
      removeComment: (postId, commentId) => set((state) => ({
        posts: state.posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: (post.comments || []).filter(
                  (comment) => comment.id !== commentId
                )
              }
            : post
        )
      })),
      updateComment: (postId, commentId, updates) => {
        const post = get().getPost(postId);
        if (!post || !get().canViewPost(post)) return;
        
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: (post.comments || []).map((comment) =>
                    comment.id === commentId
                      ? { ...comment, ...updates }
                      : comment
                  )
                }
              : post
          )
        }));
      },
      likeComment: (postId, commentId) => {
        const post = get().getPost(postId);
        if (!post || !get().canViewPost(post)) return;
        
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: (post.comments || []).map((comment) =>
                    comment.id === commentId
                      ? { ...comment, likes: comment.likes + 1 }
                      : comment
                  )
                }
              : post
          )
        }));
      },
      getPosts: () => get().posts,
      getPost: (id) => get().posts.find((post) => post.id === id),
      getUserPosts: (address) => {
        const currentUserAddress = localStorage.getItem('walletAddress');
        return get().posts.filter((post) => {
          // If looking at own posts, return all
          if (address === currentUserAddress) {
            return post.authorAddress === address;
          }
          
          // For another user's posts, filter based on visibility
          if (post.authorAddress === address) {
            return get().canViewPost(post);
          }
          
          return false;
        });
      },
      getVisiblePosts: () => {
        const currentUserAddress = localStorage.getItem('walletAddress');
        const userStore = useUserStore.getState();
        
        return get().posts.filter(post => {
          return get().canViewPost(post);
        });
      },
      updatePostVisibility: (postId, visibility) => {
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId 
              ? { ...post, visibility } 
              : post
          )
        }));
      },
      canViewPost: (post) => {
        const currentUserAddress = localStorage.getItem('walletAddress');
        const userStore = useUserStore.getState();
        
        // If no user is logged in, only show public posts
        if (!currentUserAddress) {
          return post.visibility === 'public';
        }
        
        // Post owner can always view their own posts
        if (post.authorAddress === currentUserAddress) {
          return true;
        }
        
        // Check visibility settings
        switch (post.visibility) {
          case 'public':
            return true;
            
          case 'followers':
            // If current user is in the author's followers list
            const author = userStore.getOrCreateUser(post.authorAddress);
            return author.followers.includes(currentUserAddress);
            
          case 'private':
            // If current user is in allowed addresses
            return post.allowedAddresses?.includes(currentUserAddress) || false;
            
          default:
            return false;
        }
      },
      reset: () => {
        set({ posts: [] });
      },
    }),
    {
      name: 'ipfs-x-posts-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ posts: state.posts }),
    }
  )
); 