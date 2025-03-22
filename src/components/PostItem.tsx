import { useState, useEffect } from "react";
import { Post, MediaItem } from "../models/Post";
import { formatDistanceToNow } from "date-fns";
import { FileIcon, defaultStyles } from 'react-file-icon';
import { 
  Card, 
  CardContent, 
  CardActions, 
  CardHeader,
  Avatar, 
  Typography, 
  Button, 
  Chip,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid
} from '@mui/material';
import { 
  ChatBubbleOutline, 
  Favorite, 
  FavoriteBorder,
  Share,
  Bookmark,
  BookmarkBorder,
  MoreHoriz,
  Public,
  People,
  Lock,
  Edit,
  Delete,
  NavigateBefore,
  NavigateNext,
  Close
} from '@mui/icons-material';
import { MediaPreview } from './MediaPreview';
import { ShareDialog } from './ShareDialog';
import { useUserStore } from '../store/userStore';
import { usePostStore } from '../store/postStore';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';
import { extractHashtags, linkifyHashtags } from '../utils/hashtags';
import { Link } from 'react-router-dom';
import { styled } from '@mui/material/styles';

// Custom styled components
const PostImage = styled('img')({
  width: '100%',
  maxHeight: '24rem',
  objectFit: 'cover',
  borderRadius: '4px',
  cursor: 'pointer'
});

const PostVideo = styled('video')({
  width: '100%',
  maxHeight: '24rem',
  borderRadius: '4px'
});

const LightboxWrapper = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  zIndex: 1300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}));

const LightboxImage = styled('img')({
  maxWidth: '90%',
  maxHeight: '90%',
  objectFit: 'contain'
});

const LightboxControls = styled(Box)({
  position: 'absolute',
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0 1rem'
});

const ContentDiv = styled('div')({
  marginBottom: '1rem',
  '& a': {
    color: '#1976d2',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline'
    }
  }
});

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
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
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
    setIsLiked(!isLiked);
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
          <ContentDiv dangerouslySetInnerHTML={{ __html: truncatedProcessed }} />
          <Button 
            component={Link} 
            to={`/post/${post.id}`} 
            color="primary" 
            size="small" 
            sx={{ textTransform: 'none', mb: 2 }}
          >
            Read more
          </Button>
        </>
      );
    }
    
    // Return full content with paragraph breaks and linkified hashtags
    return (
      <ContentDiv dangerouslySetInnerHTML={{ 
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

  // Get visibility icon
  const getVisibilityIcon = () => {
    switch (post.visibility) {
      case 'public':
        return <Public fontSize="small" />;
      case 'followers':
        return <People fontSize="small" />;
      case 'private':
        return <Lock fontSize="small" />;
      default:
        return <Public fontSize="small" />;
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

  // Menu handlers
  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Save post edits
  const saveEdit = () => {
    if (editContent.trim() === '') return;
    
    updatePost(post.id, { content: editContent });
    setIsEditing(false);
    // Use MUI Snackbar or other toast equivalent here
    alert("Post updated successfully");
  };
  
  // Cancel post editing
  const cancelEdit = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };
  
  // Handle post deletion
  const handleDelete = () => {
    removePost(post.id);
    // Use MUI Snackbar or other toast equivalent here
    alert("Post deleted successfully");
    setShowDeleteDialog(false);
  };

  // Share functionality
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
      alert("Pinning content requires a paid Pinata plan. Content will still be shared but may not persist long-term.");
    } else {
      alert("Web3.Storage pinning API has been sunset. Content is being shared using Pinata instead.");
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
      alert("Content successfully shared via IPFS (without pinning)");
    } else {
      alert("Content successfully shared and pinned to IPFS");
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
      <Card sx={{ mb: 4, overflow: 'hidden' }}>
        <CardHeader
          avatar={
            <Avatar
              src={author.profileImageCID ? 
                `https://ipfs.io/ipfs/${author.profileImageCID}` : 
                `https://avatar.vercel.sh/${post.authorName || post.authorAddress}`}
              alt={author.displayName || author.username || shortenAddress(post.authorAddress)}
            >
              {author.displayName?.[0] || author.username?.[0] || post.authorAddress.substring(0, 2).toUpperCase()}
            </Avatar>
          }
          action={
            isCurrentUserPost() ? (
              <IconButton aria-label="settings" onClick={handleMenuClick}>
                <MoreHoriz />
              </IconButton>
            ) : (
              <IconButton 
                component={Link} 
                to={`/post/${post.id}`}
                aria-label="more"
              >
                <MoreHoriz />
              </IconButton>
            )
          }
          title={
            <Box component={Link} to={`/profile/${post.authorAddress}`} sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {author.displayName || author.username || shortenAddress(post.authorAddress)}
            </Box>
          }
          subheader={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">{formatDate(post.timestamp)}</Typography>
              {post.category && (
                <Chip 
                  label={post.category} 
                  size="small" 
                  variant="outlined" 
                  sx={{ height: 20, fontSize: '0.7rem' }} 
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto' }}>
                {getVisibilityIcon()}
              </Box>
            </Box>
          }
          sx={{ py: 2, px: 2 }}
        />
        
        <CardContent sx={{ py: 0, px: 2 }}>
          {isEditing ? (
            <Box sx={{ pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Update your post..."
                variant="outlined"
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button variant="outlined" size="small" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button variant="contained" size="small" onClick={saveEdit} disabled={editContent.trim() === ''}>
                  Save
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ pb: 2 }}>
              {renderContent()}
            </Box>
          )}
          
          {/* Legacy media display system */}
          {mediaUrls.legacy && post.mediaType && (
            <Box sx={{ mt: 2 }}>
              {post.mediaType === 'image' && (
                <PostImage 
                  src={mediaUrls.legacy} 
                  alt="Post content" 
                  onClick={() => openLightbox(mediaUrls.legacy, 0)}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Image could not be loaded:', mediaUrls.legacy);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              {post.mediaType === 'video' && (
                <PostVideo 
                  src={mediaUrls.legacy}
                  controls
                  onError={(e: React.SyntheticEvent<HTMLVideoElement>) => {
                    console.error('Video could not be loaded:', mediaUrls.legacy);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </Box>
          )}

          {/* Media items */}
          {post.mediaItems && post.mediaItems.length > 0 && (
            <Grid container spacing={1} sx={{ mt: 1 }}>
              {post.mediaItems.map((item, index) => {
                if (!item.contentCID) return null;
                
                const mediaUrl = mediaUrls[`item-${index}`];
                const isImage = item.type === 'image';
                
                if (!mediaUrl) return null;
                
                // Calculate lightbox index
                const lightboxIndex = isImage ? lightboxImages.indexOf(mediaUrl) : -1;
                
                return (
                  <Grid 
                    item 
                    xs={post.mediaItems && post.mediaItems.length === 1 ? 12 : 6} 
                    key={item.contentCID}
                    onClick={isImage ? () => openLightbox(mediaUrl, lightboxIndex) : undefined}
                    sx={isImage ? { cursor: 'pointer' } : {}}
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
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
        
        <Divider />
        
        <CardActions sx={{ px: 2, py: 1, justifyContent: 'space-between' }}>
          <Button 
            size="small" 
            startIcon={isLiked ? <Favorite color="error" /> : <FavoriteBorder />}
            onClick={handleLike}
          >
            {post.likes || 0}
          </Button>
          
          <Button 
            size="small" 
            component={Link} 
            to={`/post/${post.id}`}
            startIcon={<ChatBubbleOutline />}
          >
            {post.comments?.length || 0}
          </Button>
          
          <Button 
            size="small" 
            startIcon={<Share />}
            onClick={handleShareClick}
          >
            Share
          </Button>
          
          <Button 
            size="small" 
            startIcon={saved ? <Bookmark /> : <BookmarkBorder />}
            onClick={handleSave}
          >
            Save
          </Button>
        </CardActions>
      </Card>

      {/* Menu for post actions */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => {
          setIsEditing(true);
          handleMenuClose();
        }}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Edit post
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            setShowDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete post
        </MenuItem>
      </Menu>

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
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Are you sure you want to delete this post?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            This action cannot be undone. The post will be permanently deleted from your profile and feed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDelete}
            color="error" 
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      {lightboxOpen && (
        <LightboxWrapper>
          <LightboxControls>
            <IconButton 
              onClick={handlePrevImage}
              color="inherit"
              sx={{ color: 'white' }}
            >
              <NavigateBefore />
            </IconButton>
            <IconButton 
              onClick={() => setLightboxOpen(false)}
              color="inherit"
              sx={{ color: 'white' }}
            >
              <Close />
            </IconButton>
            <IconButton 
              onClick={handleNextImage}
              color="inherit"
              sx={{ color: 'white' }}
            >
              <NavigateNext />
            </IconButton>
          </LightboxControls>
          <LightboxImage 
            src={currentImage}
            alt={`Post image by ${author.displayName || author.username || shortenAddress(post.authorAddress)}`}
          />
        </LightboxWrapper>
      )}

      {/* Comment form and comments */}
      {(showComments || showCommentForm) && (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mt: 2 }}>
          <CommentForm postId={post.id} postAuthorAddress={post.authorAddress} />
          
          {showComments && post.comments && post.comments.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {post.comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} postId={post.id} />
              ))}
            </Box>
          )}
        </Box>
      )}
    </>
  );
}