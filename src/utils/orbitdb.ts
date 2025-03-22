import { createHelia } from 'helia';
// @ts-ignore - No type declarations available for orbit-db
import OrbitDB from 'orbit-db';
import { createHeliaNode } from './ipfs';
import { Post } from '@/models/Post';

// Global instance for OrbitDB
let orbitdb: any = null;

// Database reference for the feed
let feedDb: any = null;
let postsDb: any = null;

// Status of initialization
let isInitializing = false;
let isInitialized = false;

// Database options
const dbOptions = {
  // Enable access control - only specified addresses can write
  accessController: {
    write: ['*'] // For now, allow any peer to write - can be restricted later
  },
  // Index by timestamp for efficient sorting
  indexBy: 'timestamp',
  // Options for the underlying IPFS datastore
  meta: {
    name: 'IPFS-X Feed Database',
    description: 'A decentralized feed for IPFS-X posts',
    type: 'feed'
  }
};

/**
 * Initialize OrbitDB and create/open the feed database
 */
export const initOrbitDB = async (): Promise<boolean> => {
  if (isInitialized) return true;
  if (isInitializing) {
    // Wait for initialization to finish if it's in progress
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return isInitialized;
  }
  
  try {
    isInitializing = true;
    console.log('Initializing OrbitDB...');
    
    // Get Helia instance first
    const helia = await createHeliaNode();
    if (!helia) {
      console.error('Failed to initialize Helia node for OrbitDB');
      isInitializing = false;
      return false;
    }
    
    // Create OrbitDB instance
    orbitdb = await OrbitDB.createInstance(helia);
    console.log('OrbitDB instance created');
    
    // Open the posts database
    postsDb = await orbitdb.docstore('ipfs-x-posts', dbOptions);
    await postsDb.load();
    console.log('Posts database loaded, address:', postsDb.address.toString());
    
    // Open the feed database (eventlog for activity feed)
    feedDb = await orbitdb.feed('ipfs-x-feed', dbOptions);
    await feedDb.load();
    console.log('Feed database loaded, address:', feedDb.address.toString());
    
    isInitializing = false;
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing OrbitDB:', error);
    isInitializing = false;
    return false;
  }
};

/**
 * Add a post to the database
 */
export const addPostToOrbit = async (post: Post): Promise<string | null> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return null;
    }
    
    // Add the post to the posts database
    const hash = await postsDb.put({
      _id: post.id,
      ...post,
      updatedAt: Date.now()
    });
    
    // Also add to the feed for activity tracking
    await feedDb.add({
      type: 'post',
      postId: post.id,
      authorAddress: post.authorAddress,
      timestamp: post.timestamp || Date.now(),
      visibility: post.visibility
    });
    
    console.log('Post added to OrbitDB:', hash);
    
    // Trigger replication
    replicateData();
    
    return hash;
  } catch (error) {
    console.error('Error adding post to OrbitDB:', error);
    return null;
  }
};

/**
 * Get all posts from the database
 */
export const getPostsFromOrbit = async (): Promise<Post[]> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return [];
    }
    
    // Get all posts
    const posts = postsDb.get('');
    
    // Sort by timestamp, newest first
    return posts.sort((a: Post, b: Post) => 
      (b.timestamp || 0) - (a.timestamp || 0)
    );
  } catch (error) {
    console.error('Error getting posts from OrbitDB:', error);
    return [];
  }
};

/**
 * Get a post by ID
 */
export const getPostFromOrbit = async (id: string): Promise<Post | null> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return null;
    }
    
    const posts = postsDb.get(id);
    return posts.length > 0 ? posts[0] : null;
  } catch (error) {
    console.error(`Error getting post ${id} from OrbitDB:`, error);
    return null;
  }
};

/**
 * Update a post
 */
export const updatePostInOrbit = async (id: string, updates: Partial<Post>): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return false;
    }
    
    // Get the existing post
    const posts = postsDb.get(id);
    if (posts.length === 0) return false;
    
    const post = posts[0];
    
    // Update the post
    const updatedPost = {
      ...post,
      ...updates,
      updatedAt: Date.now()
    };
    
    await postsDb.put(updatedPost);
    
    // Also add update event to feed
    await feedDb.add({
      type: 'post_update',
      postId: id,
      authorAddress: post.authorAddress,
      timestamp: Date.now(),
      visibility: updatedPost.visibility
    });
    
    // Trigger replication
    replicateData();
    
    return true;
  } catch (error) {
    console.error(`Error updating post ${id} in OrbitDB:`, error);
    return false;
  }
};

/**
 * Delete a post
 */
export const deletePostFromOrbit = async (id: string): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return false;
    }
    
    // Get the post to capture metadata before deletion
    const posts = postsDb.get(id);
    if (posts.length === 0) return false;
    
    const post = posts[0];
    
    // Delete the post
    await postsDb.del(id);
    
    // Add deletion event to feed
    await feedDb.add({
      type: 'post_delete',
      postId: id,
      authorAddress: post.authorAddress,
      timestamp: Date.now()
    });
    
    // Trigger replication
    replicateData();
    
    return true;
  } catch (error) {
    console.error(`Error deleting post ${id} from OrbitDB:`, error);
    return false;
  }
};

/**
 * Get recent activity feed
 */
export const getActivityFeed = async (limit: number = 50): Promise<any[]> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return [];
    }
    
    // Get latest entries from the feed db
    const feed = feedDb.iterator({ limit }).collect();
    
    return feed.map((entry: any) => ({
      ...entry.payload.value,
      hash: entry.hash,
      feedTimestamp: entry.payload.timestamp
    }));
  } catch (error) {
    console.error('Error getting activity feed from OrbitDB:', error);
    return [];
  }
};

/**
 * Sync OrbitDB with the post store
 */
export const syncOrbitDBWithStore = async (): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initOrbitDB();
      if (!success) return false;
    }
    
    // Import the store dynamically to avoid circular dependencies
    const { usePostStore } = await import('@/store/postStore');
    const postStore = usePostStore.getState();
    
    // Get all posts from OrbitDB
    const orbitPosts = await getPostsFromOrbit();
    
    // Get all posts from store
    const storePosts = postStore.getPosts();
    
    // Create maps for efficient lookup
    const orbitPostsMap = new Map(orbitPosts.map(post => [post.id, post]));
    const storePostsMap = new Map(storePosts.map(post => [post.id, post]));
    
    // Posts in OrbitDB but not in store - add to store
    let addedCount = 0;
    for (const [id, post] of orbitPostsMap.entries()) {
      if (!storePostsMap.has(id)) {
        postStore.addPost(post);
        addedCount++;
      }
    }
    
    // Posts in store but not in OrbitDB - add to OrbitDB
    let syncedCount = 0;
    for (const [id, post] of storePostsMap.entries()) {
      if (!orbitPostsMap.has(id)) {
        await addPostToOrbit(post);
        syncedCount++;
      }
    }
    
    console.log(`Synced OrbitDB with store: added ${addedCount} posts to store, synced ${syncedCount} posts to OrbitDB`);
    return true;
  } catch (error) {
    console.error('Error syncing OrbitDB with store:', error);
    return false;
  }
};

/**
 * Trigger replication of the database to other nodes
 */
const replicateData = () => {
  if (!isInitialized) return;
  
  // OrbitDB automatically replicates to connected peers,
  // but we can manually announce our databases to the network
  try {
    postsDb._replicator.announce();
    feedDb._replicator.announce();
  } catch (error) {
    console.warn('Error announcing databases for replication:', error);
  }
};

/**
 * Close OrbitDB databases
 */
export const closeOrbitDB = async (): Promise<void> => {
  if (!isInitialized) return;
  
  try {
    if (postsDb) await postsDb.close();
    if (feedDb) await feedDb.close();
    if (orbitdb) await orbitdb.stop();
    
    isInitialized = false;
    console.log('OrbitDB databases closed');
  } catch (error) {
    console.error('Error closing OrbitDB:', error);
  }
}; 