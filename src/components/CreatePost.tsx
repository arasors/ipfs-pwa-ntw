import { useState, useCallback, useEffect } from "react";
import { usePostStore } from "../store/postStore";
import { useUserStore } from "../store/userStore";
import { PostVisibility, MediaFile, ProcessStatus, IPFSPost } from "../models/Post";
import { useHashtagStore } from "../store/hashtagStore";
import { toast } from "sonner";
import {  Share2, Copy, ExternalLink, Globe, Users, Lock } from "lucide-react";

import { FileIcon, defaultStyles } from "react-file-icon";
import { MediaPreview } from "./MediaPreview";
import { connectWallet } from "../utils/web3auth";
import { extractHashtags } from "../utils/hashtags";
import { v4 as uuidv4 } from 'uuid';
import { useDropzone } from 'react-dropzone';

// MUI bileşenleri
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';

export default function CreatePost() {
    const { addPost } = usePostStore();
    const { currentUser } = useUserStore();
    const { updateTrendingHashtags, addRecentHashtag } = useHashtagStore();
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [visibility, setVisibility] = useState<PostVisibility>('public');
    const [allowedAddresses, setAllowedAddresses] = useState<string>('');
    
    // IPFS process status information
    const [showDialog, setShowDialog] = useState(false);
    const [processStatus, setProcessStatus] = useState<ProcessStatus>('idle');
    const [processMessage, setProcessMessage] = useState("");
    const [postCID, setPostCID] = useState("");
    const [ipfsShareUrl, setIpfsShareUrl] = useState("");
    const [ipfsError, setIpfsError] = useState("");
  
    // File upload with react-dropzone configuration
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
      // Start upload state
      setIsUploading(true);
      
      try {
        // Dynamically import IPFS modules
        const ipfsModule = await import('../utils/ipfs');
        const { addBytes } = ipfsModule;
        
        const newMediaFiles = await Promise.all(acceptedFiles.map(async (file) => {
          // Determine file type
          let fileType: 'image' | 'video' | 'document' = 'document';
          if (file.type.startsWith('image/')) {
            fileType = 'image';
          } else if (file.type.startsWith('video/')) {
            fileType = 'video';
          }
          
          // Create preview
          let preview = '';
          if (fileType === 'image' || fileType === 'video') {
            preview = URL.createObjectURL(file);
          }
          
          // Create new file object
          const mediaFile: MediaFile = {
            file,
            preview,
            type: fileType,
            uploaded: false
          };
          
          try {
            // Convert file to bytes
            const arrayBuffer = await file.arrayBuffer();
            const fileBytes = new Uint8Array(arrayBuffer);
            
            // Upload to IPFS with progress tracking
            const mediaCIDString = await addBytes(fileBytes, {
              filename: file.name,
              mimeType: file.type,
              onProgress: (progress) => {
                console.log(`Upload progress for ${file.name}: ${progress * 100}%`);
              },
              pin: true
            });
            
            if (mediaCIDString) {
              console.log('Media file IPFS CID:', mediaCIDString);
              
              // Add CID to file info
              mediaFile.cid = mediaCIDString;
              mediaFile.uploaded = true;
              
              return mediaFile;
            } else {
              throw new Error('Failed to get CID from upload');
            }
          } catch (error) {
            console.error('Error uploading media file:', error);
            toast.error(`Error uploading ${file.name}`);
            return mediaFile; // Return without CID
          }
        }));
        
        // Add new files to existing files
        setMediaFiles(prev => [...prev, ...newMediaFiles]);
      } catch (error) {
        console.error("Error in file upload process:", error);
        toast.error("File upload error. Please try again.");
      } finally {
        // Always reset uploading state
        setIsUploading(false);
      }
    }, []);
    
    // Dropzone configuration
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
      onDrop,
      accept: {
        'image/*': [],
        'video/*': [],
        'application/pdf': [],
        'application/msword': [],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
      },
      maxFiles: 5
    });
  
    // File removal function
    const removeFile = (index: number) => {
      setMediaFiles(prev => {
        const newFiles = [...prev];
        // If there's a preview URL, release it
        if (newFiles[index].preview) {
          URL.revokeObjectURL(newFiles[index].preview);
        }
        newFiles.splice(index, 1);
        return newFiles;
      });
    };
  
    // Clean up preview URLs when component unmounts
    useEffect(() => {
      return () => {
        mediaFiles.forEach(file => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
      };
    }, [mediaFiles]);
  
    // Format allowed addresses as array
    const formatAllowedAddresses = (): string[] | undefined => {
      if (visibility !== 'private' || !allowedAddresses.trim()) return undefined;
      
      return allowedAddresses
        .split(',')
        .map(address => address.trim())
        .filter(address => address.length > 0);
    };
  
    const copyToClipboard = () => {
      navigator.clipboard.writeText(ipfsShareUrl);
      toast.success("Link copied to clipboard");
    };
  
    const closeDialog = () => {
      if (processStatus === 'success' || processStatus === 'error') {
        setShowDialog(false);
        setProcessStatus('idle');
      }
    };
    
    // Post visibility icon based on selection
    const getVisibilityIcon = () => {
      switch (visibility) {
        case 'public':
          return <Globe style={{ width: 20, height: 20, marginRight: 8 }} />;
        case 'followers':
          return <Users style={{ width: 20, height: 20, marginRight: 8 }} />;
        case 'private':
          return <Lock style={{ width: 20, height: 20, marginRight: 8 }} />;
        default:
          return <Globe style={{ width: 20, height: 20, marginRight: 8 }} />;
      }
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim() && mediaFiles.length === 0) return;
  
      try {
        setIsLoading(true);
        // Show process dialog
        setShowDialog(true);
        setProcessStatus('uploading');
        setProcessMessage("Connecting to wallet...");
  
        // Connect to wallet
        const address = await connectWallet();
        setProcessMessage("Checking media files...");
  
        // Check if all media files are properly uploaded
        const allUploaded = mediaFiles.every(file => file.uploaded && file.cid);
        if (mediaFiles.length > 0 && !allUploaded) {
          setProcessMessage("Waiting for media files to finish uploading...");
          // Give a short timeout for files to finish uploading
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check again
          const stillNotUploaded = mediaFiles.some(file => !file.uploaded || !file.cid);
          if (stillNotUploaded) {
            setProcessStatus('error');
            setIpfsError("Some media files failed to upload. Please try again.");
            return;
          }
        }
  
        // Extract hashtags from content
        const hashtags = extractHashtags(content);
        
        // Create post data
        const postData: IPFSPost = {
          content,
          authorAddress: address,
          timestamp: Date.now(),
          visibility: visibility,
          allowedAddresses: formatAllowedAddresses(),
          tags: hashtags.length > 0 ? hashtags : undefined,
        };
  
        // Load IPFS node dynamically and add content
        let contentCIDString = "";
  
        try {
          // Dynamically import IPFS modules
          const ipfsModule = await import('../utils/ipfs');
          const { addJsonContent } = ipfsModule;
          
          setProcessMessage("Preparing to upload post to IPFS...");
          
          // Add media information (for multiple media support)
          if (mediaFiles.length > 0) {
            setProcessMessage("Finalizing media files...");
            // Store CIDs and types of uploaded media in an array
            const mediaItems = mediaFiles
              .filter(mediaFile => mediaFile.uploaded && mediaFile.cid)
              .map(mediaFile => ({
                contentCID: mediaFile.cid,
                type: mediaFile.type
              }));
            
            // Add media info to post data
            postData.mediaItems = mediaItems;
          }
          
          // Add JSON data to IPFS
          setProcessMessage("Uploading post content to IPFS...");
          const cid = await addJsonContent(postData);
          contentCIDString = cid?.toString() || "";
          
          // Store IPFS CID and create share URL
          setPostCID(contentCIDString);
          const shareUrl = `https://ipfs.io/ipfs/${contentCIDString}`;
          setIpfsShareUrl(shareUrl);
          
          console.log("CID of content added to IPFS:", contentCIDString);
          
          // Add post to the posts index API if this is a public post
          if (contentCIDString && visibility === 'public') {
            try {
              setProcessMessage("Adding post to global index...");
              
              const indexResponse = await fetch('/api/posts/index', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cid: contentCIDString })
              });
              
              if (indexResponse.ok) {
                console.log("Post added to global index successfully");
              } else {
                console.warn("Failed to add post to global index", await indexResponse.text());
              }
            } catch (error) {
              console.error("Error adding post to index:", error);
              // Continue even if this fails
            }
          }
          
          // Add post to our local API
          try {
            setProcessMessage("Saving post to your feed...");
            
            // Convert to the format our API expects
            const apiPost = {
              id: contentCIDString || uuidv4(),
              content: postData.content,
              authorAddress: postData.authorAddress,
              authorName: currentUser?.displayName || '',
              timestamp: postData.timestamp,
              contentCID: contentCIDString,
              mediaItems: postData.mediaItems,
              visibility: postData.visibility,
              tags: postData.tags
            };
            
            const apiResponse = await fetch('/api/posts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(apiPost)
            });
            
            if (apiResponse.ok) {
              console.log("Post added to API successfully");
            } else {
              console.warn("Failed to add post to API", await apiResponse.text());
            }
          } catch (error) {
            console.error("Error adding post to API:", error);
            // Continue even if this fails
          }
          
          setProcessMessage("Post successfully uploaded to IPFS!");
          setProcessStatus('success');
          
        } catch (error) {
          console.error("Error uploading to IPFS:", error);
          setIpfsError("An error occurred while uploading to IPFS. The post will be saved locally only.");
          setProcessStatus('error');
          // Continue creating post even if IPFS error
        }
  
        // Add post to Zustand store (use mediaItems instead of old mediaContentCID)
        addPost({
          content: postData.content,
          authorAddress: postData.authorAddress,
          timestamp: postData.timestamp,
          contentCID: contentCIDString || undefined,
          mediaItems: postData.mediaItems,
          likes: 0,
          comments: [],
          reposts: 0,
          visibility: postData.visibility,
          allowedAddresses: postData.allowedAddresses,
          tags: postData.tags,
        });
  
        // Update hashtag store with any hashtags used in the post
        if (hashtags.length > 0) {
          // Add each hashtag to recent hashtags
          hashtags.forEach(tag => addRecentHashtag(tag));
          
          // Update trending hashtags
          updateTrendingHashtags();
        }
  
        // Toast notification for post creation
        toast.success("Post successfully created!");
  
        // Clear form
        setContent("");
        setVisibility('public');
        setAllowedAddresses('');
        
        // Clear preview URLs and reset array
        mediaFiles.forEach(file => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
        setMediaFiles([]);
      } catch (error) {
        console.error("Post creation error:", error);
        toast.error("Post creation failed");
        setProcessStatus('error');
        setIpfsError("Unexpected error occurred while creating post.");
      } finally {
        setIsLoading(false);
      }
    };
  
   // Render preview of uploaded files
  const renderPreview = () => {
    if (mediaFiles.length === 0) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Grid container spacing={1}>
          {mediaFiles.map((file, index) => (
            <Grid item xs={6} key={index}>
              <Paper 
                sx={{ 
                  position: 'relative', 
                  overflow: 'hidden',
                  height: 128,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <IconButton 
                  size="small"
                  onClick={() => removeFile(index)}
                  sx={{ 
                    position: 'absolute', 
                    top: 4, 
                    right: 4, 
                    zIndex: 10,
                    bgcolor: 'background.paper',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                
                {file.type === 'image' || file.type === 'video' ? (
                  <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
                    <MediaPreview 
                      dataUrl={file.preview}
                      cid={file.cid}
                      alt={file.file.name}
                      width={300}
                      height={128}
                      mimeType={file.file.type}
                      className="h-32"
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    p: 2,
                    height: '100%'
                  }}>
                    <Box sx={{ width: 40, height: 40 }}>
                      {/* @ts-ignore */}
                      <FileIcon 
                        extension={file.file.name.split('.').pop() || ''} 
                        {...defaultStyles[file.file.name.split('.').pop() as keyof typeof defaultStyles]} 
                      />
                    </Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        mt: 1, 
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {file.file.name}
                    </Typography>
                  </Box>
                )}
                
                {!file.uploaded && (
                  <Box sx={{ 
                    position: 'absolute', 
                    inset: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.8)'
                  }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <CircularProgress size={24} />
                      <Typography variant="caption" sx={{ mt: 1 }}>Uploading...</Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <>
      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
        <Stack spacing={2}>
          <TextField
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            multiline
            rows={4}
            fullWidth
            variant="outlined"
          />
          
          {/* File uploader section */}
          <Paper
            {...getRootProps()} 
            sx={{
              p: 2,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            <input {...getInputProps()} />
            
            {isUploading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                <CircularProgress size={32} sx={{ mb: 1 }} />
                <Typography>Uploading files...</Typography>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography>
                  {isDragActive ? "Drop files here" : "Drag and drop files here, or click to select"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Supports images, videos, and documents (up to 5 files)
                </Typography>
              </Box>
            )}
          </Paper>
          
          {/* Preview section */}
          {renderPreview()}
          
          {/* Post visibility selector */}
          <FormControl fullWidth>
            <InputLabel id="visibility-select-label">Visibility</InputLabel>
            <Select
              labelId="visibility-select-label"
              value={visibility}
              label="Visibility"
              onChange={(e) => {
                setVisibility(e.target.value as PostVisibility);
                // Clear allowed addresses if not private
                if (e.target.value !== 'private') {
                  setAllowedAddresses('');
                }
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getVisibilityIcon()}
                  {selected === 'public' && "Public"}
                  {selected === 'followers' && "Followers only"}
                  {selected === 'private' && "Private (Specific addresses)"}
                </Box>
              )}
            >
              <MenuItem value="public">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Globe style={{ width: 20, height: 20, marginRight: 8 }} />
                  <Typography>Public</Typography>
                </Box>
              </MenuItem>
              
              <MenuItem value="followers">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Users style={{ width: 20, height: 20, marginRight: 8 }} />
                  <Typography>Followers only</Typography>
                </Box>
              </MenuItem>
              
              <MenuItem value="private">
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Lock style={{ width: 20, height: 20, marginRight: 8 }} />
                  <Typography>Private (Specific addresses)</Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
          
          {/* Allowed addresses input for private posts */}
          {visibility === 'private' && (
            <TextField
              fullWidth
              label="Allowed wallet addresses (comma separated)"
              value={allowedAddresses}
              onChange={(e) => setAllowedAddresses(e.target.value)}
              placeholder="0x123..., 0xabc..."
              variant="outlined"
              margin="normal"
            />
          )}
          
          <Button 
            type="submit" 
            variant="contained" 
            fullWidth
            disabled={(!content.trim() && mediaFiles.length === 0) || isLoading || isUploading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isLoading ? "Creating post..." : "Post"}
          </Button>
        </Stack>
      </Box>
      
      {/* IPFS process dialog */}
      <Dialog 
        open={showDialog} 
        onClose={() => {
          if (processStatus !== 'uploading') {
            setShowDialog(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {processStatus === 'uploading' && "Creating Post"}
          {processStatus === 'success' && "Post Created Successfully"}
          {processStatus === 'error' && "Post Creation Issue"}
        </DialogTitle>
        
        <DialogContent>
          <DialogContentText>
            {processStatus === 'uploading' && "Please wait while your post is being processed..."}
            {processStatus === 'success' && "Your post has been successfully created and shared on IPFS."}
            {processStatus === 'error' && ipfsError}
          </DialogContentText>
          
          <Box sx={{ py: 2 }}>
            {processStatus === 'uploading' && (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 2,
                my: 2
              }}>
                <CircularProgress />
                <Typography>{processMessage}</Typography>
              </Box>
            )}
            
            {processStatus === 'success' && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Share2 />
                  <Typography fontWeight="medium">Share your post on IPFS</Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField 
                    value={ipfsShareUrl} 
                    fullWidth
                    variant="outlined"
                    size="small"
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton edge="end" onClick={copyToClipboard}>
                            <Copy />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Box>
                
                <Box sx={{ pt: 1 }}>
                  <Button
                    href={ipfsShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<ExternalLink />}
                    color="primary"
                  >
                    Open in browser
                  </Button>
                </Box>
              </Stack>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={closeDialog}>
            {processStatus === 'success' || processStatus === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}