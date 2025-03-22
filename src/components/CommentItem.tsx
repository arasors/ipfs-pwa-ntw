"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Comment } from "../models/Post";
import { UserProfile } from "../models/User";
import { usePostStore } from "../store/postStore";
import { useUserStore } from "../store/userStore";
import { toast } from "sonner";

// Material UI imports
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

// Material Icons
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Local utility function
const getAddressDisplay = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

interface CommentItemProps {
  comment: Comment;
  postId: string;
}

export function CommentItem({ comment, postId }: CommentItemProps) {
  const { updateComment, removeComment } = usePostStore();
  const { getUserProfile } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const initialProfile = getUserProfile(comment.authorAddress);
  const [author, setAuthor] = useState<UserProfile>({
    address: comment.authorAddress,
    username: initialProfile?.username,
    displayName: initialProfile?.displayName,
    profileImageCID: initialProfile?.profileImageCID,
    followingCount: initialProfile?.followingCount || 0,
    followersCount: initialProfile?.followersCount || 0,
    postCount: initialProfile?.postCount || 0
  });
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchorEl);
  
  // Menu handlers
  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  // Check if current user is the comment owner
  const isCurrentUserComment = () => {
    const currentUserAddress = localStorage.getItem('walletAddress');
    return currentUserAddress === comment.authorAddress;
  };
  
  // Save comment edits
  const saveEdit = () => {
    if (editContent.trim() === '') return;
    
    updateComment(postId, comment.id, { content: editContent });
    setIsEditing(false);
    toast.success("Comment updated successfully");
  };
  
  // Cancel comment editing
  const cancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };
  
  // Handle comment deletion
  const handleDelete = () => {
    removeComment(postId, comment.id);
    toast.success("Comment deleted successfully");
    setShowDeleteDialog(false);
  };

  // Get avatar source
  const getAvatarSrc = () => {
    if (author.profileImageCID) {
      return `https://ipfs.io/ipfs/${author.profileImageCID}`;
    }
    return `https://api.dicebear.com/7.x/shapes/svg?seed=${comment.authorAddress}`;
  };
  
  // Get avatar fallback text
  const getAvatarFallback = () => {
    return (author.displayName?.[0] || author.username?.[0] || comment.authorAddress.substring(0, 2)).toUpperCase();
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, fontSize: '0.875rem' }}>
        <Avatar 
          src={getAvatarSrc()} 
          alt={author.displayName || author.username || comment.authorAddress}
          sx={{ width: 24, height: 24 }}
        >
          {getAvatarFallback()}
        </Avatar>
        
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" fontWeight="medium">
              {author.displayName || author.username || getAddressDisplay(comment.authorAddress)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
            </Typography>
            
            {isCurrentUserComment() && (
              <Box sx={{ marginLeft: 'auto' }}>
                <IconButton 
                  size="small"
                  onClick={handleMenuClick}
                  sx={{ padding: 0.5 }}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
                
                <Menu
                  anchorEl={menuAnchorEl}
                  open={menuOpen}
                  onClose={handleMenuClose}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  <MenuItem 
                    onClick={() => {
                      setIsEditing(true);
                      handleMenuClose();
                    }}
                    dense
                  >
                    <EditIcon fontSize="small" sx={{ mr: 1, fontSize: '0.875rem' }} />
                    Edit comment
                  </MenuItem>
                  <Divider />
                  <MenuItem 
                    onClick={() => {
                      setShowDeleteDialog(true);
                      handleMenuClose();
                    }}
                    dense
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" sx={{ mr: 1, fontSize: '0.875rem' }} />
                    Delete comment
                  </MenuItem>
                </Menu>
              </Box>
            )}
          </Box>
          
          {isEditing ? (
            <Box sx={{ mt: 1.5, mb: 1 }}>
              <TextField
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                multiline
                rows={3}
                fullWidth
                size="small"
                placeholder="Update your comment..."
                variant="outlined"
                sx={{ fontSize: '0.875rem' }}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
                <Button 
                  variant="contained" 
                  size="small" 
                  onClick={saveEdit} 
                  disabled={editContent.trim() === ''}
                >
                  Save
                </Button>
              </Stack>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {comment.content}
            </Typography>
          )}
        </Box>
      </Box>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      >
        <DialogTitle>
          Delete Comment
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this comment? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
} 