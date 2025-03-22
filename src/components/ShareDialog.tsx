"use client";

import { useState, useEffect } from "react";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { Copy, ExternalLink, Check, Share, Image, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { usePostStore } from "../store/postStore";
import { pinContent } from "../utils/ipfs";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cid?: string;
  postId?: string;
  title?: string;
  shareSuccess?: () => void;
}

export function ShareDialog({ 
  open, 
  onOpenChange, 
  cid, 
  postId, 
  title = "Share Content",
  shareSuccess
}: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string>("");
  const [ipfsUrl, setIpfsUrl] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [isGatewayChecking, setIsGatewayChecking] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [hasMedia, setHasMedia] = useState(false);
  const [isPinningLimited, setIsPinningLimited] = useState(false);
  const { getPost } = usePostStore();
  const post = postId ? getPost(postId) : undefined;

  const APP_URL = typeof window !== 'undefined' ? `${window.location.origin}` : '';
  
  // Set up the share URLs
  useEffect(() => {
    if (!cid && !postId) return;
    
    const setupShare = async () => {
      setIsGatewayChecking(true);
      setIsPinningLimited(false);

      // If we have a CID, create an IPFS URL
      if (cid) {
        setIpfsUrl(`https://ipfs.io/ipfs/${cid}`);
        // For direct content sharing
        setShareUrl(`${APP_URL}/ipfs/${cid}`);
        
        // Check if there was a failed pinning attempt due to Pinata plan
        const pinnedData = localStorage.getItem(`ipfs-pinned-${cid}`);
        if (pinnedData) {
          try {
            const data = JSON.parse(pinnedData);
            if (data.error === 'PAID_FEATURE_ONLY') {
              setIsPinningLimited(true);
            }
          } catch (e) {
            // Invalid JSON, ignore
          }
        }
      }
      
      // If we have a postId, create a post URL
      if (postId) {
        setShareUrl(`${APP_URL}/post/${postId}`);
        
        // Check if post has media
        if (post) {
          const hasMediaContent = Boolean(post.mediaContentCID) || 
            (Array.isArray(post.mediaItems) && post.mediaItems.length > 0);
          setHasMedia(hasMediaContent);
          
          // Ensure post content is pinned if it has a CID
          if (post.contentCID) {
            try {
              const pinResult = await pinContent(post.contentCID.toString());
              // Check if there's a pinning limitation after pinning attempt
              const pinnedData = localStorage.getItem(`ipfs-pinned-${post.contentCID.toString()}`);
              if (pinnedData) {
                try {
                  const data = JSON.parse(pinnedData);
                  if (data.error === 'PAID_FEATURE_ONLY') {
                    setIsPinningLimited(true);
                  }
                } catch (e) {
                  // Invalid JSON, ignore
                }
              }
            } catch (error) {
              console.error("Failed to pin post content:", error);
            }
          }
        }
      }
      
      // Finish gateway check
      setTimeout(() => {
        setIsGatewayChecking(false);
      }, 1000);
    };
    
    setupShare();
  }, [cid, postId, APP_URL, post]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Link copied to clipboard");
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);

      // Notify parent component that sharing was successful
      if (shareSuccess) {
        shareSuccess();
      }
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    
    try {
      // Pin any media content if available
      if (post && hasMedia) {
        // Pin main media content if exists
        if (post.mediaContentCID) {
          await pinContent(post.mediaContentCID.toString());
        }
        
        // Pin all media items if they exist
        if (post.mediaItems && post.mediaItems.length > 0) {
          const pinPromises = post.mediaItems
            .filter(item => item.contentCID)
            .map(item => pinContent(item.contentCID as string));
          
          await Promise.allSettled(pinPromises);
        }
      }
      
      if (navigator.share) {
        await navigator.share({
          title: 'IPFS-X Content',
          text: 'Check out this content on IPFS-X:',
          url: shareUrl,
        });
      } else {
        await copyToClipboard(shareUrl);
      }
      
      // Notify parent component that sharing was successful
      if (shareSuccess) {
        shareSuccess();
      }
    } catch (error) {
      console.error("Error sharing content:", error);
      toast.error("Error sharing content");
    } finally {
      setIsSharing(false);
    }
  };

  const gateways = [
    { name: "IPFS.io", url: `https://ipfs.io/ipfs/${cid}` },
    { name: "Cloudflare", url: `https://cloudflare-ipfs.com/ipfs/${cid}` },
    { name: "Dweb.link", url: `https://dweb.link/ipfs/${cid}` },
    { name: "Gateway.pinata.cloud", url: `https://gateway.pinata.cloud/ipfs/${cid}` }
  ];

  // Icon style for consistent sizing
  const iconStyle = { width: 16, height: 16 };
  const smallIconStyle = { width: 12, height: 12 };

  return (
    <Dialog 
      open={open} 
      onClose={() => onOpenChange(false)} 
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Share this content with others via a link or IPFS gateway.
        </DialogContentText>
        
        <Stack spacing={2} sx={{ py: 2 }}>
          {/* Post Share URL */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Share link:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField 
                value={shareUrl} 
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
                }}
                fullWidth
                size="small"
              />
              <IconButton
                size="small"
                onClick={() => copyToClipboard(shareUrl)}
                sx={{ flexShrink: 0 }}
              >
                {isCopied ? <Check style={iconStyle} /> : <Copy style={iconStyle} />}
              </IconButton>
            </Box>
          </Box>
          
          {/* Pinning Plan Limitation */}
          {isPinningLimited && (
            <Alert severity="warning" sx={{ bgcolor: 'rgba(255, 193, 7, 0.1)' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Box sx={{ mr: 1, mt: 0.25 }}>
                  <Info style={iconStyle} />
                </Box>
                <Typography variant="body2">
                  Pinning content requires a paid Pinata plan. Your content will still be available but may not persist long-term. Consider setting up a paid pinning service for better reliability.
                </Typography>
              </Box>
            </Alert>
          )}
          
          {/* Media content info */}
          {hasMedia && (
            <Alert severity="info">
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Box sx={{ mr: 1, mt: 0.25 }}>
                  <Image style={iconStyle} />
                </Box>
                <Typography variant="body2">
                  This post contains media that will be shared via IPFS{isPinningLimited ? " but won't be pinned due to plan limitations" : ""}.
                </Typography>
              </Box>
            </Alert>
          )}
          
          {/* Show IPFS specific information if we have a CID */}
          {cid && (
            <>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  IPFS Content ID (CID):
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField 
                    value={cid} 
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.75rem' }
                    }}
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(cid)}
                    sx={{ flexShrink: 0 }}
                  >
                    <Copy style={iconStyle} />
                  </IconButton>
                </Box>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  IPFS Gateways:
                </Typography>
                <Grid container spacing={1}>
                  {gateways.map(gateway => (
                    <Grid item xs={6} key={gateway.name}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ExternalLink style={smallIconStyle} />}
                        onClick={() => window.open(gateway.url, '_blank')}
                        disabled={isGatewayChecking}
                        sx={{ 
                          justifyContent: 'flex-start', 
                          fontSize: '0.75rem',
                          width: '100%'
                        }}
                      >
                        {gateway.name}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </>
          )}
          
          {/* Note about Web3.Storage being deprecated */}
          <Alert severity="info">
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <Box sx={{ mr: 1, mt: 0.25 }}>
                <AlertCircle style={iconStyle} />
              </Box>
              <Typography variant="body2">
                {isPinningLimited 
                  ? "Content can be shared but pinning requires a paid Pinata plan. Web3.Storage pinning API is no longer available."
                  : "Content is being pinned using Pinata instead of Web3.Storage due to API changes."}
              </Typography>
            </Box>
          </Alert>
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <Button
          variant="contained"
          onClick={handleShare}
          disabled={isSharing}
          fullWidth={true}
          sx={{ width: { sm: 'auto' } }}
          startIcon={<Share style={iconStyle} />}
        >
          {isSharing ? "Sharing..." : "Share"}
        </Button>
        
        {ipfsUrl && (
          <Button
            variant="outlined"
            onClick={() => window.open(ipfsUrl, '_blank')}
            fullWidth={true}
            sx={{ width: { sm: 'auto' } }}
            startIcon={<ExternalLink style={iconStyle} />}
          >
            View on IPFS
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
} 