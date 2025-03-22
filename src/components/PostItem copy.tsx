"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Post, MediaItem } from "@/models/Post";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
// @ts-ignore
import { FileIcon, defaultStyles } from 'react-file-icon';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Heart, Share2, Bookmark, MoreHorizontal, Globe, Users, Lock, Pencil, Trash2 } from 'lucide-react';
import { MediaPreview } from '@/lib/components/MediaPreview';
import { ShareDialog } from '@/components/ShareDialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserStore } from '@/store/userStore';
import { usePostStore } from '@/store/postStore';
import { getAddressDisplay } from '@/lib/utils';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { extractHashtags, linkifyHashtags } from '@/lib/hashtags';
import { Lightbox } from '@/components/ui/lightbox';

interface PostItemProps {
  post: Post;
  onLike?: (postId: string) => void;
  showFullContent?: boolean;
  showComments?: boolean;
}

export default function PostItem({ post, onLike, showFullContent = false, showComments = false }: PostItemProps) {
  const { likePost, updatePost, removePost } = usePostStore();
  const { getUserProfile, getOrCreateUser } = useUserStore();
  const [isLiked, setIsLiked] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<{[key: string]: string}>({});
  const [saved, setSaved] = useState(false);
  const [isClientSide, setIsClientSide] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareCompleted, setShareCompleted] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [author, setAuthor] = useState(getOrCreateUser(post.authorAddress));
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);

  // For client-side operations
  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Check for updated post data
  useEffect(() => {
    if (post) {
      setEditContent(post.content);
    }
  }, [post]);

  // Check if post data is valid
  if (!post) {
    console.error("Invalid post data provided to PostItem:", post);
    return null;
  }

  // Create IPFS URLs
  useEffect(() => {
    const loadMediaUrls = async () => {
      // Legacy single media support
      if (post.mediaContentCID) {
        const gateway = await getWorkingGateway(post.mediaContentCID.toString());
        if (gateway) {
          setMediaUrls(prev => ({ ...prev, legacy: gateway }));
        }
      }
      
      // New multiple media support
      if (post.mediaItems && post.mediaItems.length > 0) {
        const newMediaUrls: { [key: string]: string } = {};
        
        for (let i = 0; i < post.mediaItems.length; i++) {
          const item = post.mediaItems[i];
          if (item.contentCID) {
            const gateway = await getWorkingGateway(item.contentCID);
            if (gateway) {
              newMediaUrls[`item-${i}`] = gateway;
            }
          }
        }
        
        setMediaUrls(prev => ({ ...prev, ...newMediaUrls }));
      }
    };
    
    loadMediaUrls();
  }, [post.mediaContentCID, post.mediaItems, shareCompleted]);

  // Find a working IPFS gateway
  const getWorkingGateway = async (cid: string): Promise<string | null> => {
    // IPFS Gateway URLs
    const gateways = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`
    ];
    
    // Check if URL is accessible
    const checkUrl = (url: string) => {
      return new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      });
    };
    
    // Check gateways in sequence
    for (const gateway of gateways) {
      const isWorking = await checkUrl(gateway);
      if (isWorking) {
        return gateway;
      }
    }
    
    return null;
  };

  const handleLike = () => {
    if (onLike) {
      onLike(post.id);
    }
    setIsLiked(true);
  };

  const formatDate = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { 
      addSuffix: true,
      locale: undefined // Use default locale (English)
    });
  };

  // Cüzdan adresini kısaltma
  const shortenAddress = (address: string) => {
    if (!address) return "Unknown";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle save
  const handleSave = () => {
    setSaved(!saved);
  };
  
  const renderContent = () => {
    // Apply hashtag formatting to content
    const processedContent = linkifyHashtags(post.content);
    
    // If we need to truncate the content
    if (!showFullContent && post.content.length > 280) {
      // We need to be careful with HTML when truncating
      // For simplicity, truncate the original text and then linkify
      const truncatedText = post.content.substring(0, 280).trim() + '...';
      const truncatedProcessed = linkifyHashtags(truncatedText);
      
      return (
        <>
          <div className="mb-3" dangerouslySetInnerHTML={{ __html: truncatedProcessed }} />
          <Link href={`/post/${post.id}`} className="text-primary text-sm hover:underline">
            Read more
          </Link>
        </>
      );
    }
    
    // Return full content with paragraph breaks and linkified hashtags
    return (
      <div dangerouslySetInnerHTML={{ 
        __html: post.content.split('\n').map(paragraph => 
          paragraph.trim() ? linkifyHashtags(paragraph) : '<br />'
        ).join('<br />') 
      }} />
    );
  };

  // Get the CID for sharing
  const getContentCID = () => {
    return post.contentCID?.toString() || '';
  };

  // Get visibility icon and label
  const getVisibilityIcon = () => {
    switch (post.visibility) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'followers':
        return <Users className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };
  
  const getVisibilityTooltip = () => {
    switch (post.visibility) {
      case 'public':
        return 'Public post - Visible to everyone';
      case 'followers':
        return 'Followers only - Visible to your followers';
      case 'private':
        return 'Private post - Visible to specific addresses only';
      default:
        return 'Public post';
    }
  };

  // Format the timestamp
  const formattedTime = formatDistanceToNow(new Date(post.timestamp), { addSuffix: true });

  // Check if current user is the post owner
  const isCurrentUserPost = () => {
    const currentUserAddress = localStorage.getItem('walletAddress');
    return currentUserAddress === post.authorAddress;
  };

  // Save post edits
  const saveEdit = () => {
    if (editContent.trim() === '') return;
    
    updatePost(post.id, { content: editContent });
    setIsEditing(false);
    toast.success("Post updated successfully");
  };
  
  // Cancel post editing
  const cancelEdit = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };
  
  // Handle post deletion
  const handleDelete = () => {
    removePost(post.id);
    toast.success("Post deleted successfully");
    setShowDeleteDialog(false);
  };

  // Note: Added the handleShareClick function to trigger a toast notification
  const handleShareClick = () => {
    // Check if there's a pinning limitation already recorded
    let hasPinningLimitation = false;
    
    if (post.contentCID) {
      const pinnedData = localStorage.getItem(`ipfs-pinned-${post.contentCID.toString()}`);
      if (pinnedData) {
        try {
          const data = JSON.parse(pinnedData);
          if (data.error === 'PAID_FEATURE_ONLY') {
            hasPinningLimitation = true;
          }
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    }
    
    // Show appropriate message based on pinning status
    if (hasPinningLimitation) {
      toast.info(
        "Pinning content requires a paid Pinata plan. Content will still be shared but may not persist long-term.",
        {
          duration: 5000,
        }
      );
    } else {
      toast.info(
        "Web3.Storage pinning API has been sunset. Content is being shared using Pinata instead.",
        {
          duration: 5000,
        }
      );
    }
    
    setShowShareDialog(true);
  };

  const handleShareSuccess = () => {
    // Force UI update after sharing completes
    setShareCompleted(!shareCompleted);
    
    // Check if there's a pinning limitation for the content
    let hasPinningLimitation = false;
    
    if (post.contentCID) {
      const pinnedData = localStorage.getItem(`ipfs-pinned-${post.contentCID.toString()}`);
      if (pinnedData) {
        try {
          const data = JSON.parse(pinnedData);
          if (data.error === 'PAID_FEATURE_ONLY') {
            hasPinningLimitation = true;
          }
        } catch (e) {
          // Invalid JSON, ignore
        }
      }
    }
    
    // Show appropriate success message
    if (hasPinningLimitation) {
      toast.success("Content successfully shared via IPFS (without pinning)");
    } else {
      toast.success("Content successfully shared and pinned to IPFS");
    }
  };

  // Initialize lightbox images when mediaUrls are loaded
  useEffect(() => {
    const images: string[] = [];
    
    // Add legacy image if it exists
    if (mediaUrls.legacy && post.mediaType === 'image') {
      images.push(mediaUrls.legacy);
    }
    
    // Add media items that are images
    if (post.mediaItems && post.mediaItems.length > 0) {
      Object.keys(mediaUrls)
        .filter(key => key.startsWith('item-'))
        .forEach(key => {
          const index = parseInt(key.replace('item-', ''));
          if (post.mediaItems && post.mediaItems[index] && post.mediaItems[index].type === 'image') {
            images.push(mediaUrls[key]);
          }
        });
    }
    
    setLightboxImages(images);
  }, [mediaUrls, post.mediaItems, post.mediaType]);
  
  const openLightbox = (src: string, index: number) => {
    setCurrentImage(src);
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };
  
  const handlePrevImage = () => {
    const newIndex = (currentImageIndex - 1 + lightboxImages.length) % lightboxImages.length;
    setCurrentImageIndex(newIndex);
    setCurrentImage(lightboxImages[newIndex]);
  };
  
  const handleNextImage = () => {
    const newIndex = (currentImageIndex + 1) % lightboxImages.length;
    setCurrentImageIndex(newIndex);
    setCurrentImage(lightboxImages[newIndex]);
  };

  return (
    <>
      <Card className="mb-4 overflow-hidden">
        <CardHeader className="py-4 px-4 flex-row items-center gap-3">
          <Avatar>
            <AvatarImage 
              src={author.profileImageCID ? 
                `https://ipfs.io/ipfs/${author.profileImageCID}` : 
                `https://avatar.vercel.sh/${post.authorName || post.authorAddress}`} 
            />
            <AvatarFallback>
              {author.displayName?.[0] || author.username?.[0] || post.authorAddress.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <Link href={`/profile/${post.authorAddress}`} className="font-medium text-sm hover:underline">
              {author.displayName || author.username || shortenAddress(post.authorAddress)}
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatDate(post.timestamp)}</span>
              {post.category && (
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                  {post.category}
                </span>
              )}
            </div>
          </div>
          
          {isCurrentUserPost() ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-auto rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="ml-auto rounded-full" asChild>
              <Link href={`/post/${post.id}`}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Link>
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="px-4 py-0">
          {isEditing ? (
            <div className="pb-4 space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[120px]"
                placeholder="Update your post..."
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={editContent.trim() === ''}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {renderContent()}
            </div>
          )}
          
          {/* Eski medya görüntüleme sistemi */}
          {mediaUrls.legacy && post.mediaType && (
            <div className="mt-4">
              {post.mediaType === 'image' && (
                <img 
                  src={mediaUrls.legacy} 
                  alt="Post content" 
                  className="w-full rounded-md max-h-96 object-cover cursor-pointer"
                  onClick={() => openLightbox(mediaUrls.legacy, 0)}
                  onError={(e) => {
                    console.error('Image could not be loaded:', mediaUrls.legacy);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              {post.mediaType === 'video' && (
                <video 
                  src={mediaUrls.legacy}
                  controls
                  className="w-full rounded-md max-h-96"
                  onError={(e) => {
                    console.error('Video could not be loaded:', mediaUrls.legacy);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </div>
          )}

          {/* Media items */}
          {post.mediaItems && post.mediaItems.length > 0 && (
            <div className={`
              grid gap-2 mt-3
              ${post.mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}
            `}>
              {post.mediaItems.map((item, index) => {
                if (!item.contentCID) return null;
                
                const mediaUrl = mediaUrls[`item-${index}`];
                const isImage = item.type === 'image';
                
                if (!mediaUrl) return null;
                
                // Calculate lightbox index
                const lightboxIndex = isImage ? lightboxImages.indexOf(mediaUrl) : -1;
                
                return (
                  <div 
                    key={item.contentCID} 
                    className={`overflow-hidden rounded-md ${isImage ? 'cursor-pointer' : ''}`}
                    onClick={isImage ? () => openLightbox(mediaUrl, lightboxIndex) : undefined}
                  >
                    <MediaPreview 
                      cid={item.contentCID} 
                      width={post.mediaItems && post.mediaItems.length === 1 ? 500 : 250} 
                      height={250}
                      className="w-full"
                      mimeType={
                        item.type === 'image' ? 'image/jpeg' : 
                        item.type === 'video' ? 'video/mp4' : 
                        item.type === 'document' ? 'application/pdf' :
                        undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="px-4 py-3 border-t flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleLike}>
            <Heart className={`h-4 w-4 mr-1 ${isLiked ? 'fill-destructive text-destructive' : ''}`} />
            {post.likes || 0}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/post/${post.id}`}>
              <MessageSquare className="h-4 w-4 mr-1" />
              {post.comments?.length || 0}
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleShareClick}
          >
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSave}>
            <Bookmark className={`h-4 w-4 mr-1 ${saved ? 'fill-current' : ''}`} />
            Save
          </Button>
        </CardFooter>
      </Card>

      {/* Share Dialog */}
      <ShareDialog 
        open={showShareDialog} 
        onOpenChange={setShowShareDialog}
        cid={getContentCID()}
        postId={post.id}
        title="Share Post"
        shareSuccess={handleShareSuccess}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The post will be permanently deleted from your profile and feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={currentImage}
        alt={`Post image by ${author.displayName || author.username || shortenAddress(post.authorAddress)}`}
        
      />

      {/* Comment form and comments */}
      {(showComments || showCommentForm) && (
        <div className="border-t px-4 py-3">
          <CommentForm postId={post.id} postAuthorAddress={post.authorAddress} />
          
          {showComments && post.comments.length > 0 && (
            <div className="mt-4 space-y-3">
              {post.comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} postId={post.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
} 