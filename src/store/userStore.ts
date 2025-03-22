import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { User, UserProfile } from '@/models/User';
import { useNotificationStore } from './notificationStore';

interface UserState {
  // State
  currentUser: User | null;
  users: Record<string, User>;
  loading: boolean;
  
  // Actions
  setCurrentUser: (address: string) => Promise<void>;
  updateCurrentUser: (userData: Partial<User>) => void;
  getOrCreateUser: (address: string) => User;
  getUserProfile: (userId: string) => UserProfile | null;
  followUser: (userIdToFollow: string) => void;
  unfollowUser: (userIdToUnfollow: string) => void;
  isFollowing: (targetAddress: string) => boolean;
  getFollowers: (address: string) => string[];
  getFollowing: (address: string) => string[];
  fetchUsersByAddresses: (addresses: string[]) => Promise<void>;
  
  // Helper functions
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: {},
      loading: false,
      
      setCurrentUser: async (address) => {
        const user = get().getOrCreateUser(address);
        set({ currentUser: user });
      },
      
      updateCurrentUser: (userData) => {
        if (!get().currentUser) return;
        
        const currentUser = get().currentUser!;
        const updatedUser = {
          ...currentUser,
          ...userData,
          updatedAt: Date.now()
        };
        
        set((state) => ({
          currentUser: updatedUser,
          users: {
            ...state.users,
            [updatedUser.address]: updatedUser
          }
        }));
      },
      
      getOrCreateUser: (address) => {
        const { users } = get();
        
        if (users[address]) {
          return users[address];
        }
        
        // Create new user if not exists
        const newUser: User = {
          address,
          followingCount: 0,
          followersCount: 0,
          posts: [],
          following: [],
          followers: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        set((state) => ({
          users: {
            ...state.users,
            [address]: newUser
          }
        }));
        
        return newUser;
      },
      
      getUserProfile: (userId) => {
        const { users, currentUser } = get();
        const user = users[userId];
        
        // If user doesn't exist, return a minimal profile
        if (!user) {
          return {
            address: userId,
            followingCount: 0,
            followersCount: 0,
            postCount: 0,
            isCurrentUser: false,
            isFollowing: false
          };
        }
        
        const profile: UserProfile = {
          address: user.address,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImageCID: user.profileImageCID,
          coverImageCID: user.coverImageCID,
          followingCount: user.followingCount,
          followersCount: user.followersCount,
          postCount: user.posts.length,
          isCurrentUser: currentUser?.address === userId,
          isFollowing: currentUser ? user.followers.includes(currentUser.address) : false
        };
        
        return profile;
      },
      
      followUser: (userIdToFollow) => {
        const { currentUser, users } = get();
        if (!currentUser || currentUser.address === userIdToFollow) return;
        
        // If already following, do nothing
        if (currentUser.following.includes(userIdToFollow)) return;
        
        // Update current user
        const updatedCurrentUser = {
          ...currentUser,
          following: [...currentUser.following, userIdToFollow],
          followingCount: currentUser.followingCount + 1,
          updatedAt: Date.now()
        };
        
        // Update target user
        const targetUser = get().getOrCreateUser(userIdToFollow);
        const updatedTargetUser = {
          ...targetUser,
          followers: [...targetUser.followers, currentUser.address],
          followersCount: targetUser.followersCount + 1,
          updatedAt: Date.now()
        };
        
        set((state) => ({
          currentUser: updatedCurrentUser,
          users: {
            ...state.users,
            [currentUser.address]: updatedCurrentUser,
            [userIdToFollow]: updatedTargetUser
          }
        }));
        
        // Create follow notification
        const notificationStore = useNotificationStore.getState();
        notificationStore.addNotification({
          type: 'follow',
          title: 'New Follower',
          message: `${currentUser.displayName || currentUser.username || currentUser.address} started following you`,
          actorAddress: currentUser.address,
          actorName: currentUser.displayName || currentUser.username,
          recipientAddress: userIdToFollow
        });
      },
      
      unfollowUser: (userIdToUnfollow) => {
        const { currentUser, users } = get();
        if (!currentUser || currentUser.address === userIdToUnfollow) return;
        
        // If not following, do nothing
        if (!currentUser.following.includes(userIdToUnfollow)) return;
        
        // Update current user
        const updatedCurrentUser = {
          ...currentUser,
          following: currentUser.following.filter(addr => addr !== userIdToUnfollow),
          followingCount: Math.max(0, currentUser.followingCount - 1),
          updatedAt: Date.now()
        };
        
        // Update target user
        const targetUser = users[userIdToUnfollow];
        if (targetUser) {
          const updatedTargetUser = {
            ...targetUser,
            followers: targetUser.followers.filter(addr => addr !== currentUser.address),
            followersCount: Math.max(0, targetUser.followersCount - 1),
            updatedAt: Date.now()
          };
          
          set((state) => ({
            currentUser: updatedCurrentUser,
            users: {
              ...state.users,
              [currentUser.address]: updatedCurrentUser,
              [userIdToUnfollow]: updatedTargetUser
            }
          }));
        } else {
          // If target user not in store, just update current user
          set((state) => ({
            currentUser: updatedCurrentUser,
            users: {
              ...state.users,
              [currentUser.address]: updatedCurrentUser
            }
          }));
        }
      },
      
      isFollowing: (targetAddress) => {
        const { currentUser } = get();
        if (!currentUser) return false;
        return currentUser.following.includes(targetAddress);
      },
      
      getFollowers: (address) => {
        const user = get().users[address];
        if (!user) return [];
        return user.followers;
      },
      
      getFollowing: (address) => {
        const user = get().users[address];
        if (!user) return [];
        return user.following;
      },
      
      fetchUsersByAddresses: async (addresses: string[]) => {
        set(state => ({ loading: true }));
        
        try {
          // Filter out addresses that already exist in the store
          const uniqueAddresses = addresses.filter(address => !get().users[address]);
          
          // In a real app, you would fetch users from API here
          // For now, just create placeholder users for each address
          const newUsers: Record<string, User> = {};
          
          uniqueAddresses.forEach(address => {
            newUsers[address] = get().getOrCreateUser(address);
          });
          
          // Update store with new users
          set(state => ({ 
            users: {
              ...state.users,
              ...newUsers
            },
            loading: false 
          }));
        } catch (error) {
          console.error('Error fetching users:', error);
          set(state => ({ loading: false }));
        }
        
        return Promise.resolve();
      },
      
      reset: () => {
        set({ currentUser: null });
        localStorage.removeItem('walletAddress');
      }
    }),
    {
      name: 'user-storage',
    }
  )
); 