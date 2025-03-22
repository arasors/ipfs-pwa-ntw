import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

// Material UI imports
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// Material Icons
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';

import { Message } from '../models/Message';

type ChatBubbleProps = {
  message: Message;
  isOwn: boolean;
  sender?: {
    name?: string;
    address: string;
    avatar?: string;
  };
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onViewHistory?: (messageId: string) => void;
};

export function ChatBubble({ 
  message, 
  isOwn, 
  sender,
  onEdit,
  onDelete,
  onViewHistory
}: ChatBubbleProps) {
  const [showTime, setShowTime] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  
  const toggleTime = () => setShowTime(!showTime);
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setMenuAnchorEl(null);
  
  // Format the sender's name or address
  const senderName = sender?.name || (sender?.address ? `${sender.address.slice(0, 6)}...${sender.address.slice(-4)}` : 'Unknown');
  
  // Get the first letter of the sender's name for the avatar fallback
  const avatarFallback = senderName.charAt(0).toUpperCase();
  
  // Format the timestamp
  const formattedTime = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });
  
  // Determine if the message has editable content
  const hasEditableContent = Boolean(message.content && message.content.trim());
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: isOwn ? 'flex-end' : 'flex-start', 
        mb: 2
      }}
      onClick={toggleTime}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: isOwn ? 'row-reverse' : 'row', 
          alignItems: 'flex-end', 
          gap: 1, 
          maxWidth: '85%' 
        }}
      >
        {/* Avatar */}
        {!isOwn && (
          <Avatar 
            src={sender?.avatar} 
            alt={senderName}
            sx={{ width: 32, height: 32 }}
          >
            {avatarFallback}
          </Avatar>
        )}
        
        {/* Message content */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start'
        }}>
          {/* Sender name for group chats (hidden by default) */}
          {!isOwn && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ mb: 0.5 }}
            >
              {senderName}
            </Typography>
          )}
          
          {/* Message bubble */}
          <Box sx={{ display: 'flex' }}>
            <Paper
              elevation={0}
              sx={{
                py: 1,
                px: 1.5,
                backgroundColor: isOwn ? 'primary.main' : 'action.hover',
                color: isOwn ? 'primary.contrastText' : 'text.primary',
                borderBottomRightRadius: isOwn ? 0 : undefined,
                borderBottomLeftRadius: !isOwn ? 0 : undefined,
                wordBreak: 'break-word'
              }}
            >
              {/* Message content */}
              {message.content && (
                <Typography 
                  variant="body2" 
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {message.content}
                </Typography>
              )}
              
              {/* Media attachments */}
              {message.mediaItems && message.mediaItems.length > 0 && (
                <Box 
                  sx={{ 
                    mt: 1, 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: 1 
                  }}
                >
                  {message.mediaItems.map((media, index) => (
                    <Box key={index} sx={{ position: 'relative' }}>
                      {media.mimeType.startsWith('image/') ? (
                        <Box
                          component="img"
                          src={`https://ipfs.io/ipfs/${media.cid}`}
                          alt="Media"
                          sx={{
                            maxWidth: '100%',
                            borderRadius: 1,
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // onOpenMedia?.(index);
                          }}
                        />
                      ) : media.mimeType.startsWith('video/') ? (
                        <Box
                          component="video"
                          src={`https://ipfs.io/ipfs/${media.cid}`}
                          controls
                          sx={{
                            maxWidth: '100%',
                            borderRadius: 1
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                          <Box
                            component="a"
                            href={`https://ipfs.io/ipfs/${media.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              color: 'primary.main',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              textDecoration: 'none',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Attachment
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
              
              {/* Edited indicator */}
              {message.isEdited && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    opacity: 0.7, 
                    ml: 0.5 
                  }}
                >
                  (edited)
                </Typography>
              )}
              
              {/* Message time - always visible on mobile, toggle on desktop */}
              {(showTime || window.innerWidth < 640) && (
                <Box sx={{ 
                  mt: 0.5, 
                  textAlign: isOwn ? 'right' : 'left', 
                  opacity: 0.7 
                }}>
                  <Typography variant="caption">
                    {formattedTime}
                  </Typography>
                </Box>
              )}
            </Paper>
            
            {/* Message actions (for own messages) */}
            {isOwn && onEdit && onDelete && (
              <Box sx={{ 
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 1 },
                '.MuiBubble-root:hover &': { opacity: 1 }
              }}>
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{ ml: 0.5 }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={menuAnchorEl}
                  open={Boolean(menuAnchorEl)}
                  onClose={handleMenuClose}
                >
                  {hasEditableContent && (
                    <MenuItem 
                      onClick={() => {
                        onEdit(message.id, message.content || '');
                        handleMenuClose();
                      }}
                    >
                      <EditIcon fontSize="small" sx={{ mr: 1 }} />
                      Edit
                    </MenuItem>
                  )}
                  
                  <MenuItem 
                    onClick={() => {
                      onDelete(message.id);
                      handleMenuClose();
                    }}
                  >
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                    Delete
                  </MenuItem>
                  
                  {message.isEdited && onViewHistory && (
                    <MenuItem 
                      onClick={() => {
                        onViewHistory(message.id);
                        handleMenuClose();
                      }}
                    >
                      <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
                      View edit history
                    </MenuItem>
                  )}
                </Menu>
              </Box>
            )}
          </Box>
          
          {/* Message delivery status */}
          {isOwn && (
            <Tooltip title={message.read ? 'Read' : 'Delivered'} placement="left">
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ mt: 0.5 }}
              >
                {message.read ? 'Read' : 'Delivered'}
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
} 