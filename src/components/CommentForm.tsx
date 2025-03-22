"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Comment } from "../models/Post";
import { useUserStore } from "../store/userStore";
import { usePostStore } from "../store/postStore";
import { addJson } from "../utils/ipfs";
import { useNotificationStore } from "../store/notificationStore";

// Material UI imports
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

interface CommentFormProps {
  postId: string;
  postAuthorAddress: string;
  onCommentAdded?: () => void;
}

export function CommentForm({ 
  postId, 
  postAuthorAddress,
  onCommentAdded 
}: CommentFormProps) {
  const { currentUser } = useUserStore();
  const { addComment } = usePostStore();
  const { addNotification } = useNotificationStore();
  
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError("You must be logged in to comment");
      return;
    }
    
    if (!content.trim()) {
      setError("Comment cannot be empty");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Create comment object
      const comment: Comment = {
        id: uuidv4(),
        content: content.trim(),
        authorAddress: currentUser.address,
        authorName: currentUser.displayName || currentUser.username,
        timestamp: Date.now(),
        likes: 0
      };
      
      // Store comment on IPFS
      const cidStr = await addJson(comment);
      if (cidStr) {
        comment.contentCID = cidStr;
        
        // Add comment to post
        addComment(postId, comment);
        
        // Create notification for post author if it's not the current user
        if (postAuthorAddress !== currentUser.address) {
          addNotification({
            type: 'comment',
            title: 'New Comment',
            message: `${currentUser.displayName || currentUser.username || currentUser.address} commented on your post`,
            actorAddress: currentUser.address,
            actorName: currentUser.displayName || currentUser.username,
            recipientAddress: postAuthorAddress,
            postId
          });
        }
        
        // Reset form
        setContent("");
        
        // Callback
        if (onCommentAdded) {
          onCommentAdded();
        }
      } else {
        throw new Error("Failed to add comment to IPFS");
      }
    } catch (err) {
      console.error("Error adding comment:", err);
      setError("Failed to add comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get avatar fallback text
  const getAvatarFallback = () => {
    if (!currentUser) return "U";
    return (currentUser.displayName?.[0] || currentUser.username?.[0] || currentUser.address[0]).toUpperCase();
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      sx={{ 
        pt: 3, 
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Avatar 
            src={currentUser?.profileImageCID ? 
              `https://ipfs.io/ipfs/${currentUser.profileImageCID}` : 
              undefined
            } 
            alt={currentUser?.displayName || currentUser?.username || currentUser?.address || "User"}
            sx={{ width: 32, height: 32 }}
          >
            {getAvatarFallback()}
          </Avatar>
          
          <TextField
            placeholder="Write a comment..."
            value={content}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContent(e.target.value)}
            multiline
            rows={3}
            fullWidth
            disabled={isSubmitting || !currentUser}
            sx={{ flexGrow: 1 }}
          />
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ py: 0 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            type="submit" 
            variant="contained"
            disabled={isSubmitting || !content.trim() || !currentUser}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSubmitting ? "Submitting..." : "Comment"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
} 