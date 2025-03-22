"use client";
import { useState, useEffect } from "react";
import { Post } from "../models/Post";
import PostItem from "../components/PostItem";
// IPFS modüllerini doğrudan import etmiyoruz
// import { createHeliaNode, getJsonContent } from "@/lib/ipfs";
import type { CID } from 'multiformats/cid';
import { CID as CIDClass } from 'multiformats/cid';
import { usePostStore } from "../store/postStore";

interface PostListProps {
  posts: Post[];
  isLoading?: boolean;
}

export default function PostList({ posts: initialPosts, isLoading = false }: PostListProps) {
  const { likePost } = usePostStore();
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading, setLoading] = useState(isLoading);
  const [loadedPosts, setLoadedPosts] = useState<Record<string, boolean>>({});

  // Post'ları prop değişikliklerinde güncelle
  useEffect(() => {
    console.log("PostList'e gelen post'lar:", initialPosts);
    if (initialPosts && initialPosts.length > 0) {
      setPosts(initialPosts);
      
      // Her post için IPFS içeriğini yüklemeyi dene
      const loadPostContents = async () => {
        const updatedPosts = [...initialPosts];
        let hasChanges = false;
        
        for (let i = 0; i < updatedPosts.length; i++) {
          const post = updatedPosts[i];
          // Zaten yüklenmişse atla
          if (loadedPosts[post.id]) continue;
          
          try {
            if (post.contentCID) {
              const enrichedPost = await fetchPostContent(post);
              if (enrichedPost !== post) {
                updatedPosts[i] = enrichedPost;
                hasChanges = true;
                // Yüklenen postu işaretle
                setLoadedPosts(prev => ({...prev, [post.id]: true}));
              }
            }
          } catch (error) {
            console.error(`Post ${post.id} içeriği alınırken hata:`, error);
          }
        }
        
        if (hasChanges) {
          setPosts(updatedPosts);
        }
      };
      
      loadPostContents();
    }
  }, [initialPosts]);

  // Post'un IPFS içeriğini getir
  const fetchPostContent = async (post: Post) => {
    try {
      if (!post.contentCID) return post;

      console.log(`Fetching IPFS content for post ${post.id}, CID:`, post.contentCID);

      // IPFS modüllerini dinamik olarak import et
      const ipfsModule = await import('../utils/ipfs');
      
      const { jsonHandler } = await ipfsModule.createHeliaNode();
      let cid: CID;

      if (typeof post.contentCID === 'string') {
        try {
          cid = CIDClass.parse(post.contentCID);
        } catch (error) {
          console.error('CID parsing error:', error);
          return post;
        }
      } else {
        cid = post.contentCID;
      }

      const content = await ipfsModule.getJsonContent(cid.toString());
      console.log('IPFS content retrieved:', content);
      return { ...post, ...content };
    } catch (error) {
      console.error("Error fetching post content:", error);
      return post;
    }
  };

  // Post beğenme fonksiyonu - Zustand store'u kullanarak
  const handleLike = (postId: string) => {
    likePost(postId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="bg-card animate-pulse p-4 rounded-lg shadow"
            style={{ height: '150px' }}
          />
        ))}
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-lg">
        <p className="text-muted-foreground">Henüz hiç post yok.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostItem key={post.id} post={post} onLike={handleLike} />
      ))}
    </div>
  );
} 