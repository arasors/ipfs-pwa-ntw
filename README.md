# IPFS Social PWA

[![IPFS](https://img.shields.io/badge/IPFS-Powered-blue.svg)](https://ipfs.tech/)
[![OrbitDB](https://img.shields.io/badge/OrbitDB-Enabled-orange.svg)](https://github.com/orbitdb/orbit-db)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

## 🌟 Overview

**IPFS Social PWA** is a decentralized social networking application built with React and TypeScript that leverages IPFS (InterPlanetary File System) and OrbitDB for peer-to-peer data storage and communication. This Progressive Web Application enables users to share content, interact through a feed interface, and communicate directly with other users in a completely decentralized manner.

## ✨ Key Features

- **Decentralized Architecture**: All content is stored on IPFS, eliminating the need for centralized servers
- **Social Feed**: Users can create, view, and interact with posts from the network
- **Real-time Chat**: Direct peer-to-peer messaging between users
- **PWA Support**: Works offline and installs on any device
- **Responsive Design**: Built with Material UI for a consistent experience across all devices

## 🚀 Technology Stack

### Core Technologies
| Technology | Description |
|------------|-------------|
| [IPFS](https://ipfs.tech/) | Decentralized peer-to-peer hypermedia protocol |
| [OrbitDB](https://github.com/orbitdb/orbit-db) | Peer-to-peer database built on IPFS |
| [Helia](https://github.com/ipfs/helia) | Implementation of IPFS for JavaScript environments |
| [React](https://react.dev/) | Frontend library for building user interfaces |
| [TypeScript](https://www.typescriptlang.org/) | Typed superset of JavaScript |
| [Material UI](https://mui.com/) | React UI framework with a comprehensive component library |
| [Zustand](https://github.com/pmndrs/zustand) | State management solution |

## 📁 Project Structure

```
ipfs-pwa-ntw/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── AuthGuard/  # Authentication protection
│   │   ├── BoardFeed/  # Social feed component
│   │   ├── CreatePost/ # Post creation form
│   │   └── ...
│   ├── models/         # TypeScript interfaces/types
│   │   ├── Post.ts     # Post data structure
│   │   ├── Message.ts  # Chat message data structure
│   │   └── ...
│   ├── pages/          # Application pages
│   │   ├── Page1/      # Social feed page
│   │   ├── Page2/      # Chat interface
│   │   └── ...
│   ├── store/          # State management
│   │   ├── postStore.ts    # Post data and actions
│   │   ├── messageStore.ts # Chat messages and actions
│   │   └── ...
│   ├── utils/          # Utility functions
│   │   ├── ipfs.ts         # IPFS node initialization and operations
│   │   ├── orbitdb.ts      # OrbitDB for posts/feeds
│   │   ├── orbitdb-messages.ts # OrbitDB for messaging
│   │   └── ...
│   └── ...
└── ...
```

## 💻 IPFS & OrbitDB Integration

### IPFS Configuration

The application creates and manages a Helia IPFS node in the browser:

```typescript
// src/utils/ipfs.ts
export const createHeliaNode = async () => {
  if (heliaNode) return heliaNode;
  
  try {
    const blockstore = new MemoryBlockstore();
    const datastore = new MemoryDatastore();

    heliaNode = await createHelia({
      blockstore,
      datastore
    });
    
    console.log('Helia node created successfully');
    return heliaNode;
  } catch (error) {
    console.error('Failed to create Helia node:', error);
    return null;
  }
};
```

### OrbitDB Data Storage

The application uses OrbitDB to store and sync decentralized data:

1. **Posts Database**: For social feed content
   ```typescript
   // src/utils/orbitdb.ts
   export const initOrbitDB = async () => {
     // Create OrbitDB instance
     orbitdb = await OrbitDB.createInstance(helia);
     
     // Open the posts database
     postsDb = await orbitdb.docstore('ipfs-x-posts', dbOptions);
     await postsDb.load();
     
     // Open the feed database (eventlog for activity feed)
     feedDb = await orbitdb.feed('ipfs-x-feed', dbOptions);
     await feedDb.load();
   };
   ```

2. **Messages Database**: For peer-to-peer chat
   ```typescript
   // src/utils/orbitdb-messages.ts
   export const initMessageDB = async () => {
     // Create OrbitDB instance
     orbitdb = await OrbitDB.createInstance(helia);
     
     // Open the chats database
     chatsDb = await orbitdb.docstore('ipfs-x-chats', {
       ...dbOptions,
       indexBy: 'id'
     });
     
     // Open the messages database
     messagesDb = await orbitdb.docstore('ipfs-x-messages', {
       ...dbOptions,
       indexBy: 'id'
     });
   };
   ```

## 📱 Main Application Features

### Social Feed (Page1)

The social feed enables users to:

- Create and publish posts to the decentralized network
- View a timeline of posts from the network
- Filter content by different criteria (recent, following, etc.)
- Interact with posts from other users

Implementation details:
```typescript
// src/pages/Page1/Page1.tsx
export default function FeedPage() {
  // Initialize IPFS and OrbitDB
  useEffect(() => {
    const loadData = async () => {
      try {
        await initOrbitDB();
        await syncFeeds();
        updateTrendingHashtags();
      } catch (error) {
        console.error('Feed data loading error:', error);
      }
    };
    
    loadData();
    // Periodic sync interval
  }, []);
  
  // Feed component with post rendering
  return (
    <AuthGuard>
      <Box>
        {/* Post creation component */}
        <CreatePost />
        
        {/* Feed display */}
        <BoardFeed 
          mode={activeTab}
          currentUserAddress={currentUserAddress || ''}
          isFollowingHashtag={isFollowingHashtag}
          getUserProfile={getUserProfile}
          isLoading={!isInitialized}
          isSyncing={isSyncing}
        />
      </Box>
    </AuthGuard>
  );
}
```

### Chat System (Page2)

The decentralized chat system allows users to:

- Display their own IPFS identity (wallet address)
- Connect with other users by their IPFS ID
- Send and receive messages in real-time
- View message history that persists across sessions

Implementation details:
```typescript
// src/pages/Page2/Page2.tsx
function Page2() {
  // State for chat UI
  const [message, setMessage] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [connected, setConnected] = useState(false);
  
  // Get user ID from wallet
  const currentUserId = localStorage.getItem('walletAddress');
  
  // Initialize chat system
  useEffect(() => {
    const initializeIPFS = async () => {
      await initOrbitDB();
      await syncMessagesWithOrbitDB();
    };
    
    initializeIPFS();
    // Periodic sync interval
  }, []);
  
  // Connect to another user
  const handleConnect = () => {
    const chat = getOrCreateChat(recipientId);
    selectChat(chat.id);
    setConnected(true);
  };
  
  // Send message function
  const handleSendMessage = async () => {
    await sendMessage({
      chatId: selectedChatId,
      content: message
    });
    setMessage('');
  };
  
  // Chat UI rendering
  return (
    <AuthGuard>
      <Box>
        {/* User ID display */}
        <Card>
          <Typography>Your ID</Typography>
          <TextField
            value={currentUserId || ''}
            InputProps={{ readOnly: true }}
          />
          <IconButton onClick={copyIdToClipboard}>
            <FileCopyIcon />
          </IconButton>
        </Card>
        
        {/* Connect to recipient */}
        <Card>
          <Typography>Connect to Someone</Typography>
          <TextField
            label="Enter recipient ID"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          />
          <Button onClick={handleConnect}>
            Connect
          </Button>
        </Card>
        
        {/* Chat messages */}
        <Paper>
          <List>
            {currentMessages.map((msg) => (
              <ListItem key={msg.id}>
                <Paper>
                  <Typography>{msg.content}</Typography>
                  <Typography variant="caption">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </Typography>
                </Paper>
              </ListItem>
            ))}
          </List>
        </Paper>
        
        {/* Message input */}
        <TextField
          placeholder="Type a message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button onClick={handleSendMessage}>Send</Button>
      </Box>
    </AuthGuard>
  );
}
```

## 🔄 Data Synchronization

The application handles data synchronization across the IPFS network:

1. **Post Synchronization**:
   ```typescript
   export const syncFeeds = async () => {
     // Get local posts
     const storePostsMap = new Map(postsArray.map(post => [post.id, post]));
     
     // Get remote posts from OrbitDB
     const orbitPosts = await getPostsFromOrbit();
     const orbitPostsMap = new Map(orbitPosts.map(post => [post.id, post]));
     
     // Sync posts in both directions
     // Local to remote sync
     for (const [postId, localPost] of storePostsMap) {
       if (!orbitPostsMap.has(postId)) {
         await addPostToOrbit(localPost);
       }
     }
     
     // Remote to local sync
     for (const [postId, remotePost] of orbitPostsMap) {
       if (!storePostsMap.has(postId)) {
         storeState.addOrUpdatePost(remotePost);
       }
     }
   };
   ```

2. **Message Synchronization**:
   ```typescript
   export const syncMessagesWithOrbitDB = async () => {
     // Sync chats
     const storeChats = messageStore.chats;
     const orbitChats = await getAllChats();
     
     // Create maps for lookup
     const storeChatsMap = new Map(Object.entries(storeChats));
     const orbitChatsMap = new Map(orbitChats.map(chat => [chat.id, chat]));
     
     // Sync in both directions
     // Remote to local
     for (const [chatId, orbitChat] of orbitChatsMap.entries()) {
       if (!storeChatsMap.has(chatId)) {
         useMessageStore.setState(state => ({
           chats: {
             ...state.chats,
             [chatId]: orbitChat
           }
         }));
       }
     }
     
     // Local to remote
     for (const [chatId, storeChat] of storeChatsMap.entries()) {
       if (!orbitChatsMap.has(chatId)) {
         await saveChat(storeChat);
       }
     }
     
     // Similar process for messages
   };
   ```

## 📊 Data Models

### Message Model

```typescript
// src/models/Message.ts
export interface Message {
  id: string;
  chatId: string;
  senderAddress: string;
  content: string;
  timestamp: number;
  read: boolean;
  mediaItems?: {
    cid: string;
    mimeType: string;
  }[];
  isEdited?: boolean;
  editHistory?: {
    content: string;
    timestamp: number;
  }[];
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: {
    content: string;
    timestamp: number;
    senderAddress: string;
  };
  unreadCount: number;
  isBlocked?: boolean;
}
```

### Post Model

```typescript
// src/models/Post.ts
export interface Post {
  id: string;
  content: string;
  authorAddress: string;
  timestamp: number;
  likes: string[];
  comments: Comment[];
  hashtags: string[];
  attachments?: {
    cid: string;
    type: string;
    name?: string;
  }[];
  visibility: 'public' | 'private' | 'followers';
}

export interface Comment {
  id: string;
  content: string;
  authorAddress: string;
  timestamp: number;
  likes: string[];
}
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/arasors/ipfs-pwa-ntw.git

# Navigate to the project directory
cd ipfs-pwa-ntw

# Install dependencies
npm install
# or
yarn

# Start the development server
npm run dev
# or
yarn dev
```

### Building for Production

```bash
npm run build
# or
yarn build
```

## 💡 How It Works

### P2P Communication Flow

1. **Node Creation**: When a user opens the application, a Helia IPFS node is created in their browser
2. **Database Initialization**: OrbitDB databases are initialized on top of IPFS
3. **Data Synchronization**: The application syncs with the OrbitDB network to get the latest content
4. **Content Creation**: When a user creates content, it's:
   - Stored locally in the state management store
   - Written to the local OrbitDB database
   - Automatically replicated to other peers via IPFS
5. **Real-time Updates**: Other users' content is automatically received and displayed

### Chat Connection Process

1. **Identity**: Each user is identified by their wallet address
2. **Connection**: To chat with someone, a user enters the recipient's wallet address
3. **Chat Creation**: A chat record is created in OrbitDB, indexed by a unique chat ID
4. **Message Exchange**: Messages are written to OrbitDB and synced across participants
5. **Persistence**: Chat history is persisted across sessions through OrbitDB's IPFS storage

## 🔒 Security and Privacy

- **Decentralized Identity**: Users are identified by their wallet addresses
- **Peer-to-peer Communication**: No central server storing or monitoring messages
- **Data Ownership**: Users maintain control of their own data
- **Content Addressability**: IPFS ensures content integrity through CIDs (Content Identifiers)

## 📝 License

[MIT](./LICENSE)
