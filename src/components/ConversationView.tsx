"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMessageStore } from '../store/messageStore';

// Material UI imports
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// Material Icons
import SendIcon from '@mui/icons-material/Send';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';

import { formatDistanceToNow, format } from 'date-fns';
import { Lightbox, LightboxModal } from './lightbox';
import { MediaPicker } from './MediaPicker';
import { uploadToIPFS } from '../utils/ipfs-upload';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ContactCard } from './ContactCard';
import { BackButton } from './BackButton';
import { syncMessages } from '../utils/syncMessages';
import { Message } from '../models/Message';

type ConversationViewProps = {
  chatId?: string;
};

export function ConversationView({ chatId }: ConversationViewProps) {
  const router = useRouter();
  const params = useParams();
  const [messageContent, setMessageContent] = useState('');
  const [mediaItems, setMediaItems] = useState<{ cid: string; mimeType: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEditHistory, setShowEditHistory] = useState<string | null>(null);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<string | null>(null);
  const [confirmDeleteChat, setConfirmDeleteChat] = useState(false);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { 
    chats, 
    messages, 
    selectedChatId,
    selectChat,
    markMessagesAsRead,
    deleteMessage,
    deleteChat,
    editMessage,
    sendMessage,
    getMessageEditHistory
  } = useMessageStore();
  
  // Kullanıcının bilgilerini localStorage'dan alıyoruz çünkü userStore'a tam erişimimiz yok
  const userAddress = localStorage.getItem('walletAddress') || '';
  const userDisplayName = localStorage.getItem('userDisplayName') || '';
  const userAvatar = localStorage.getItem('userAvatar') || '';
  
  // Geçici olarak kullanıcı bilgisi
  const user = {
    address: userAddress,
    name: userDisplayName
  };
  
  // Geçici olarak kullanıcılar listesi
  const usersByAddress: Record<string, { address: string, name?: string, avatar?: string }> = {};
  
  // Fallback to URL param if no chatId is provided as prop
  const resolvedChatId = chatId || (params?.chatId as string);
  
  const chat = chats[resolvedChatId];
  const chatMessages = messages[resolvedChatId] || [];
  
  // Determine the recipient address (the one that isn't the current user)
  const recipientAddress = chat?.participants.find(
    (address) => user && address !== user.address
  ) || '';
  
  const recipient = usersByAddress[recipientAddress] || { address: recipientAddress };
  
  useEffect(() => {
    if (resolvedChatId && resolvedChatId !== selectedChatId) {
      selectChat(resolvedChatId);
    }
  }, [resolvedChatId, selectedChatId, selectChat]);
  
  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Mark messages as read when the chat is viewed
    if (resolvedChatId && user) {
      const unreadMessages = chatMessages.filter(
        msg => !msg.read && msg.senderAddress !== user.address
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(resolvedChatId);
        
        // Ensure messages are synced with OrbitDB after marking as read
        syncMessages(Date.now() - 60000); // Sync recent messages
      }
    }
  }, [resolvedChatId, chatMessages, user, markMessagesAsRead]);
  
  // Handle case where chat doesn't exist
  if (!chat) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Conversation not found</p>
      </div>
    );
  }
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that either text or media is present
    if (!messageContent.trim() && mediaItems.length === 0) {
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await sendMessage({
        chatId: resolvedChatId,
        content: messageContent.trim(),
        mediaItems: mediaItems,
      });
      
      // Reset form
      setMessageContent('');
      setMediaItems([]);
      
      // Focus back on textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleMediaPicked = async (files: File[]) => {
    setMediaPickerOpen(false);
    if (!files.length) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const newMediaItems = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToIPFS(file);
          return {
            cid: result.cid,
            mimeType: result.mimeType
          };
        })
      );
      
      setMediaItems([...mediaItems, ...newMediaItems]);
    } catch (error) {
      console.error('Error uploading media:', error);
      setError('Failed to upload media. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const removeMediaItem = (index: number) => {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  };
  
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  
  // Group messages by date
  const messagesByDate: { [date: string]: typeof chatMessages } = {};
  chatMessages.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });
  
  // Helper to check if this is a self conversation (messaging yourself)
  const isSelfConversation = chat?.participants.length === 1 || 
                             (chat?.participants.length === 2 && 
                              chat.participants[0] === chat.participants[1]);

  // Use the appropriate profile based on whether this is a self conversation
  const displayProfile = isSelfConversation ? user : recipient;
  
  // Gather all image media items for the lightbox
  const allImageItems = chatMessages
    .flatMap(msg => msg.mediaItems || [])
    .filter(item => item.mimeType.startsWith('image/'))
    .map(item => ({ src: `https://ipfs.io/ipfs/${item.cid}`, alt: 'Media' }));
    
  // Handle message edit
  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };
  
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };
  
  const handleSaveEdit = () => {
    if (editingMessageId && editContent.trim()) {
      editMessage(resolvedChatId, editingMessageId, editContent);
      setEditingMessageId(null);
      setEditContent('');
    }
  };
  
  // Handle message deletion
  const handleDeleteMessage = () => {
    if (confirmDeleteMessage) {
      deleteMessage(resolvedChatId, confirmDeleteMessage);
      setConfirmDeleteMessage(null);
    }
  };
  
  // Handle chat deletion
  const handleDeleteChat = () => {
    if (confirmDeleteChat) {
      deleteChat(resolvedChatId);
      setConfirmDeleteChat(false);
    }
  };
  
  // Get message edit history
  const getHistoryForMessage = (messageId: string) => {
    return getMessageEditHistory(resolvedChatId, messageId);
  };
  
  const isOwnMessage = (message: Message) => {
    return message.senderAddress === user.address;
  };
  
  // Fix Dialog implementation to match MUI's API
  const handleEditHistoryClose = () => {
    setShowEditHistory(null);
  };

  const handleDeleteMessageClose = () => {
    setConfirmDeleteMessage(null);
  };

  const handleDeleteChatClose = () => {
    setConfirmDeleteChat(false);
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ 
        p: 1.5, 
        borderBottom: 1, 
        borderColor: 'divider', 
        display: 'flex', 
        alignItems: 'center' 
      }}>
        <Box sx={{ display: { xs: 'block', sm: 'none' }, mr: 1 }}>
          <BackButton onClick={() => router.push('/messages')} />
        </Box>
        
        {recipient ? (
          <ContactCard 
            user={recipient} 
            compact
            showStatus
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              bgcolor: 'action.hover', 
              width: 40, 
              height: 40, 
              borderRadius: '50%' 
            }}></Box>
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {recipientAddress ? 
                  `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}` : 
                  'Unknown'
                }
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
      
      {/* Messages */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2 
      }}>
        {isFetchingMessages ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            py: 5 
          }}>
            <CircularProgress size={24} color="primary" />
          </Box>
        ) : chatMessages.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            py: 5 
          }}>
            <Typography color="text.secondary">No messages yet</Typography>
          </Box>
        ) : (
          <>
            {Object.entries(messagesByDate).map(([date, dateMessages]) => (
              <Box key={date} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      bgcolor: 'action.hover', 
                      px: 1, 
                      py: 0.5, 
                      borderRadius: 10,
                      color: 'text.secondary'
                    }}
                  >
                    {date === new Date().toDateString() ? 'Today' : date}
                  </Typography>
                </Box>
                
                <Stack spacing={2}>
                  {dateMessages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      isOwn={isOwnMessage(message)}
                      sender={usersByAddress[message.senderAddress]}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Input */}
      <ChatInput
        chatId={resolvedChatId}
        recipientAddress={recipientAddress}
      />
      
      {/* Edit history dialog */}
      <Dialog open={showEditHistory !== null} onClose={handleEditHistoryClose}>
        <DialogTitle>Edit History</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Previous versions of this message:
          </DialogContentText>
          {showEditHistory && (
            <Box sx={{ mt: 2, maxHeight: 384, overflow: 'auto' }}>
              <Stack spacing={2}>
                {getHistoryForMessage(showEditHistory)?.map((history, index) => (
                  <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {history.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(history.timestamp), 'PPpp')}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete message confirmation dialog */}
      <Dialog open={confirmDeleteMessage !== null} onClose={handleDeleteMessageClose}>
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this message? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteMessageClose}>
            Cancel
          </Button>
          <Button onClick={handleDeleteMessage} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete chat confirmation dialog */}
      <Dialog open={confirmDeleteChat} onClose={handleDeleteChatClose}>
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this entire conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteChatClose}>
            Cancel
          </Button>
          <Button onClick={handleDeleteChat} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Message input area */}
      <Box sx={{ 
        borderTop: 1, 
        borderColor: 'divider', 
        p: 1.5 
      }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}
        
        {mediaItems.length > 0 && (
          <Box sx={{ 
            mb: 1.5, 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1 
          }}>
            {mediaItems.map((media, index) => (
              <Box key={index} sx={{ position: 'relative' }}>
                {media.mimeType.startsWith('image/') ? (
                  <Box sx={{ 
                    position: 'relative', 
                    width: 64, 
                    height: 64 
                  }}>
                    <Box
                      component="img"
                      src={`https://ipfs.io/ipfs/${media.cid}`}
                      alt="Media preview"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 1
                      }}
                    />
                    <IconButton
                      onClick={() => removeMediaItem(index)}
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        p: 0.5,
                        '&:hover': {
                          bgcolor: 'error.dark'
                        }
                      }}
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: 'action.hover',
                    p: 1,
                    borderRadius: 1
                  }}>
                    <ImageIcon fontSize="small" />
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        maxWidth: 100, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}
                    >
                      Attachment
                    </Typography>
                    <IconButton
                      onClick={() => removeMediaItem(index)}
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'error.main',
                        color: 'error.contrastText',
                        p: 0.5,
                        '&:hover': {
                          bgcolor: 'error.dark'
                        }
                      }}
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
        
        <Box 
          component="form" 
          onSubmit={handleSendMessage}
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1
          }}
        >
          <IconButton
            onClick={() => setMediaPickerOpen(true)}
            disabled={isSubmitting}
            size="medium"
          >
            <AddCircleIcon />
          </IconButton>
          
          <TextField
            value={messageContent}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessageContent(e.target.value)}
            placeholder="Type a message..."
            multiline
            maxRows={4}
            fullWidth
            disabled={isSubmitting}
            variant="outlined"
            size="small"
            sx={{ flexGrow: 1 }}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as unknown as React.FormEvent);
              }
            }}
          />
          
          <IconButton
            type="submit"
            disabled={isSubmitting || (!messageContent.trim() && mediaItems.length === 0)}
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
      
      {mediaPickerOpen && (
        <MediaPicker 
          onClose={() => setMediaPickerOpen(false)}
          onSubmit={handleMediaPicked}
          maxFiles={5}
          accept="image/*,video/*,audio/*,application/pdf"
        />
      )}
      
      {lightboxOpen && allImageItems.length > 0 && (
        <LightboxModal
          images={allImageItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </Box>
  );
} 