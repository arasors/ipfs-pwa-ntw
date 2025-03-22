import { useState, useEffect, useRef } from 'react';
import { 
  Typography, 
  Box, 
  TextField, 
  Button, 
  Paper, 
  List, 
  ListItem, 
  Divider, 
  Grid, 
  IconButton, 
  CircularProgress,
  Card,
  CardContent,
  Avatar,
  Chip,
  Drawer,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Badge,
  useTheme,
  useMediaQuery
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import ForumIcon from '@mui/icons-material/Forum';
import CloseIcon from '@mui/icons-material/Close';
import { AuthGuard } from '../../components/AuthGuard';
import { useMessageStore } from '../../store/messageStore';
import { syncMessagesWithOrbitDB } from '../../utils/orbitdb-messages';
import { initOrbitDB } from '../../utils/orbitdb';

// Sidebar genişliği
const SIDEBAR_WIDTH = 300;

function Page2() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentChat, setCurrentChat] = useState<any>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const messageEndRef = useRef<null | HTMLDivElement>(null);
  
  // Get the current wallet address as our ID
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
  
  // Get message store functions
  const { 
    getOrCreateChat,
    getChatMessages,
    sendMessage,
    chats,
    messages,
    selectedChatId,
    selectChat,
    markMessagesAsRead
  } = useMessageStore();

  // Initialize IPFS and OrbitDB
  useEffect(() => {
    const initializeIPFS = async () => {
      try {
        setIsLoading(true);
        await initOrbitDB();
        await syncMessagesWithOrbitDB();
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing IPFS:', error);
        setIsLoading(false);
      }
    };
    
    initializeIPFS();
    
    // Sync messages periodically
    const intervalId = setInterval(async () => {
      try {
        setIsSyncing(true);
        await syncMessagesWithOrbitDB();
      } catch (error) {
        console.error('Error syncing messages:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 10000); // Sync daha sık - her 10 saniyede bir
    
    return () => clearInterval(intervalId);
  }, []);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChatId]);
  
  // Update currentChat when selectedChatId changes
  useEffect(() => {
    if (selectedChatId && chats[selectedChatId]) {
      setCurrentChat(chats[selectedChatId]);
      setConnected(true);
      
      // Mark messages as read when chat is selected
      markMessagesAsRead(selectedChatId);
    }
  }, [selectedChatId, markMessagesAsRead]);
  
  // Connect to a recipient
  const handleConnect = () => {
    if (!recipientId || !currentUserId) return;
    
    try {
      const chat = getOrCreateChat(recipientId);
      selectChat(chat.id);
      setCurrentChat(chat);
      setConnected(true);
      setMobileSidebarOpen(false); // Close mobile sidebar after connecting
    } catch (error) {
      console.error('Error connecting to recipient:', error);
    }
  };
  
  // Send a message
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChatId) return;
    
    try {
      await sendMessage({
        chatId: selectedChatId,
        content: message
      });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  // Copy ID to clipboard
  const copyIdToClipboard = () => {
    if (currentUserId) {
      navigator.clipboard.writeText(currentUserId);
    }
  };
  
  // Handle key press (Enter to send)
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };
  
  // Get current chat messages
  const currentMessages = selectedChatId ? getChatMessages(selectedChatId) : [];
  
  // Helper to truncate long addresses
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return address.length > 10 ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address;
  };
  
  // Get chat list from store
  const chatList = Object.values(chats).sort((a, b) => {
    // Sort by last message timestamp (newest first)
    const aTimestamp = a.lastMessage?.timestamp || 0;
    const bTimestamp = b.lastMessage?.timestamp || 0;
    return bTimestamp - aTimestamp;
  });
  
  // Get recipient address from chat
  const getRecipientAddress = (chat: any) => {
    if (!chat || !chat.participants) return '';
    return chat.participants.find((p: string) => p !== currentUserId) || '';
  };
  
  // Format last message time
  const formatLastMessageTime = (timestamp: number) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    
    // If same day, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If within last week, show day
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  // Manuel senkronizasyon fonksiyonu 
  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      console.log("Manuel senkronizasyon başlatıldı");
      await syncMessagesWithOrbitDB();
      console.log("Manuel senkronizasyon tamamlandı");
    } catch (error) {
      console.error('Error during manual sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Render chat sidebar
  const renderSidebar = () => (
    <Box 
      sx={{ 
        width: SIDEBAR_WIDTH, 
        flexShrink: 0,
        height: '100%', 
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>Messages</Typography>
        <Grid container spacing={1}>
          <Grid item xs>
            <TextField
              fullWidth
              size="small"
              placeholder="Search or enter ID"
              variant="outlined"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              size="small"
              disabled={!recipientId}
              onClick={handleConnect}
            >
              Connect
            </Button>
          </Grid>
        </Grid>
        
        {/* Manuel senkronizasyon butonu ekle */}
        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={handleManualSync}
          disabled={isSyncing}
          sx={{ mt: 1 }}
        >
          {isSyncing ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          Sync
        </Button>
      </Box>
      
      <List sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={30} />
          </Box>
        ) : chatList.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="textSecondary">No messages yet</Typography>
            <Typography variant="body2" color="textSecondary">
              Start a new chat by entering an ID
            </Typography>
          </Box>
        ) : (
          chatList.map(chat => {
            const recipientAddress = getRecipientAddress(chat);
            const isSelected = selectedChatId === chat.id;
            
            return (
              <ListItemButton 
                key={chat.id}
                selected={isSelected}
                onClick={() => {
                  selectChat(chat.id);
                  setMobileSidebarOpen(false); // Close mobile sidebar when selecting chat
                }}
                sx={{ 
                  borderLeft: isSelected ? 3 : 0, 
                  borderColor: 'primary.main',
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                  }
                }}
              >
                <ListItemAvatar>
                  <Badge
                    color="error"
                    badgeContent={chat.unreadCount}
                    invisible={chat.unreadCount === 0}
                  >
                    <Avatar>
                      {recipientAddress.substring(0, 2)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText 
                  primary={truncateAddress(recipientAddress)}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography 
                        variant="body2" 
                        component="span" 
                        sx={{ 
                          maxWidth: '70%', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {chat.lastMessage?.content || 'Yeni sohbet'}
                      </Typography>
                      {chat.lastMessage?.timestamp && (
                        <Typography variant="caption" component="span">
                          {formatLastMessageTime(chat.lastMessage.timestamp)}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            );
          })
        )}
      </List>
      
      {isSyncing && (
        <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
          <CircularProgress size={14} sx={{ mr: 1 }} />
          <Typography variant="caption">Senkronize ediliyor...</Typography>
        </Box>
      )}
    </Box>
  );
  
  // Mobile drawer for sidebar
  const mobileSidebar = (
    <Drawer
      variant="temporary"
      open={mobileSidebarOpen}
      onClose={() => setMobileSidebarOpen(false)}
      sx={{
        '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH },
        display: { xs: 'block', md: 'none' }
      }}
    >
      {renderSidebar()}
    </Drawer>
  );

  return (
    <AuthGuard>
      <Box sx={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        height: 'calc(100vh - 100px)', 
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Typography variant="h4" gutterBottom>Sohbet</Typography>
        
        <Box sx={{ 
          display: 'flex', 
          flex: 1,
          height: 'calc(100% - 40px)', 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          {/* Sidebar - yalnızca desktop için görünür*/}
          {!isMobile && renderSidebar()}
          
          {/* Mobile sidebar */}
          {mobileSidebar}
          
          {/* Main content */}
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%',
            position: 'relative'
          }}>
            {/* User ID panel and connection buttons at top */}
            <Box sx={{ 
              p: 2, 
              borderBottom: '1px solid', 
              borderColor: 'divider',
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {isMobile && (
                  <IconButton 
                    edge="start" 
                    onClick={() => setMobileSidebarOpen(true)} 
                    sx={{ mr: 1 }}
                  >
                    <ForumIcon />
                  </IconButton>
                )}
                
                {currentChat ? (
                  <>
                    <Avatar sx={{ mr: 1 }}>
                      {getRecipientAddress(currentChat).substring(0, 2)}
                    </Avatar>
                    <Typography>
                      {truncateAddress(getRecipientAddress(currentChat))}
                    </Typography>
                  </>
                ) : (
                  <Typography>Mesajlar</Typography>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Manuel senkronizasyon butonu */}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Sync messages"
                >
                  {isSyncing ? (
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                  ) : null}
                  Sync
                </Button>
                
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileCopyIcon />}
                  onClick={copyIdToClipboard}
                >
                  {truncateAddress(currentUserId || '')}
                </Button>
              </Box>
            </Box>
            
            {/* Chat Interface */}
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress />
              </Box>
            ) : connected && currentChat ? (
              <>
                {/* Messages Area */}
                <Box sx={{ 
                  flexGrow: 1, 
                  overflow: 'auto', 
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {currentMessages.length === 0 ? (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      height: '100%',
                      flexDirection: 'column',
                      gap: 2
                    }}>
                      <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}>
                        <ForumIcon sx={{ fontSize: 40 }} />
                      </Avatar>
                      <Typography color="textSecondary">
                        No messages yet. Start a chat!
                      </Typography>
                    </Box>
                  ) : (
                    <List>
                      {currentMessages.map((msg) => {
                        const isMe = msg.senderAddress === currentUserId;
                        
                        return (
                          <ListItem 
                            key={msg.id}
                            sx={{ 
                              display: 'flex',
                              justifyContent: isMe ? 'flex-end' : 'flex-start',
                              mb: 1,
                              py: 0.5
                            }}
                          >
                            <Box sx={{ display: 'flex', maxWidth: '80%' }}>
                              {!isMe && (
                                <Avatar sx={{ mr: 1, width: 32, height: 32 }}>
                                  {msg.senderAddress.substring(0, 2)}
                                </Avatar>
                              )}
                              
                              <Paper
                                sx={{
                                  p: 1.5,
                                  bgcolor: isMe ? 'primary.main' : 'grey.100',
                                  color: isMe ? 'primary.contrastText' : 'inherit',
                                  borderRadius: 2,
                                }}
                              >
                                <Typography variant="body1">{msg.content}</Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    display: 'block', 
                                    textAlign: 'right',
                                    color: isMe ? 'primary.contrastText' : 'text.secondary',
                                    mt: 0.5
                                  }}
                                >
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Paper>
                              
                              {isMe && (
                                <Avatar sx={{ ml: 1, width: 32, height: 32 }}>
                                  {currentUserId?.substring(0, 2)}
                                </Avatar>
                              )}
                            </Box>
                          </ListItem>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </List>
                  )}
                </Box>
                
                {/* Sync indicator - daha görünür hale getir */}
                {isSyncing && (
                  <Box sx={{ 
                    position: 'absolute', 
                    top: 60, 
                    right: 10, 
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)', // Mavi ton
                    p: 1,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'primary.main'
                  }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="caption">Syncing...</Typography>
                  </Box>
                )}
                
                {/* Message Input */}
                <Box sx={{ p: 2, backgroundColor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={1}>
                    <Grid item xs>
                      <TextField
                        fullWidth
                        placeholder="Write a message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        variant="outlined"
                        multiline
                        maxRows={4}
                        size="small"
                      />
                    </Grid>
                    <Grid item>
                      <Button 
                        onClick={handleSendMessage} 
                        variant="contained" 
                        color="primary" 
                        endIcon={<SendIcon />}
                        disabled={!message.trim()}
                        sx={{ height: '100%' }}
                      >
                        Send
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </>
            ) : (
              <Box sx={{ 
                p: 4,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                flexDirection: 'column',
                gap: 2
              }}>
                <Avatar sx={{ width: 100, height: 100, bgcolor: 'primary.main' }}>
                  <ForumIcon sx={{ fontSize: 60 }} />
                </Avatar>
                <Typography variant="h6" gutterBottom>
                  Start a chat by connecting
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom textAlign="center">
                  Select a user from the chat list or
                  start a chat by entering the other party's ID.
                </Typography>
                
                <Box sx={{ width: '100%', maxWidth: 400, mt: 2 }}>
                  <TextField
                    fullWidth
                    label="Enter the ID of the user you want to connect to"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    variant="outlined"
                    placeholder="0x123..."
                    sx={{ mb: 1 }}
                  />
                  <Button 
                    variant="contained" 
                    fullWidth
                    onClick={handleConnect} 
                    disabled={!recipientId || isLoading}
                  >
                    Connect
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </AuthGuard>
  );
}

export default Page2;
