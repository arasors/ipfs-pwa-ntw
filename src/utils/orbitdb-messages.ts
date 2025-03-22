// @ts-ignore - No type declarations available for orbit-db
import OrbitDB from 'orbit-db';
import { createHeliaNode } from './ipfs';
import { Chat, Message } from '@/models/Message';

// Global instance for OrbitDB
let orbitdb: any = null;

// Database references
let messagesDb: any = null;
let chatsDb: any = null;

// Status of initialization
let isInitializing = false;
let isInitialized = false;

// Database options
const dbOptions = {
  // Enable access control - only specified addresses can write
  accessController: {
    write: ['*'] // For now, allow any peer to write - can be restricted later
  },
  // Options for the underlying IPFS datastore
  meta: {
    name: 'IPFS-X Messages Database',
    description: 'A decentralized messaging system for IPFS-X',
    type: 'docstore'
  }
};

/**
 * Initialize OrbitDB and create/open the messages database
 */
export const initMessageDB = async (): Promise<boolean> => {
  if (isInitialized) return true;
  if (isInitializing) {
    // Wait for initialization to finish if it's in progress
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return isInitialized;
  }
  
  try {
    isInitializing = true;
    console.log('Initializing Messages OrbitDB...');
    
    // Get Helia instance first
    const helia = await createHeliaNode();
    if (!helia) {
      console.error('Failed to initialize Helia node for Messages OrbitDB');
      isInitializing = false;
      return false;
    }
    
    // Create OrbitDB instance
    orbitdb = await OrbitDB.createInstance(helia);
    console.log('Messages OrbitDB instance created');
    
    // Open the chats database
    chatsDb = await orbitdb.docstore('ipfs-x-chats', {
      ...dbOptions,
      indexBy: 'id' // Index chats by their id
    });
    await chatsDb.load();
    console.log('Chats database loaded, address:', chatsDb.address.toString());
    
    // Open the messages database
    messagesDb = await orbitdb.docstore('ipfs-x-messages', {
      ...dbOptions,
      indexBy: 'id' // Index messages by their id
    });
    await messagesDb.load();
    console.log('Messages database loaded, address:', messagesDb.address.toString());
    
    isInitializing = false;
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing Messages OrbitDB:', error);
    isInitializing = false;
    return false;
  }
};

/**
 * Add or update a chat in the database
 */
export const saveChat = async (chat: Chat): Promise<string | null> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return null;
    }
    
    // Add the chat to the database
    const hash = await chatsDb.put({
      _id: chat.id, // Required for docstore
      ...chat,
      updatedAt: Date.now()
    });
    
    console.log('Chat saved to OrbitDB:', hash);
    return hash;
  } catch (error) {
    console.error('Error saving chat to OrbitDB:', error);
    return null;
  }
};

/**
 * Add a message to the database
 */
export const saveMessage = async (message: Message): Promise<string | null> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return null;
    }
    
    // Add the message to the database
    const hash = await messagesDb.put({
      _id: message.id, // Required for docstore
      ...message,
      savedAt: Date.now() // Add a timestamp for when it was saved
    });
    
    console.log('Message saved to OrbitDB:', hash);
    return hash;
  } catch (error) {
    console.error('Error saving message to OrbitDB:', error);
    return null;
  }
};

/**
 * Get all chats from the database
 */
export const getAllChats = async (): Promise<Chat[]> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return [];
    }
    
    // Get all chats from the database
    const chats = chatsDb.get('');
    
    return chats.map((chat: any) => {
      const { _id, ...chatData } = chat; // Remove _id which is just a duplicate of id
      return chatData as Chat;
    });
  } catch (error) {
    console.error('Error getting chats from OrbitDB:', error);
    return [];
  }
};

/**
 * Get all messages for a specific chat
 */
export const getChatMessages = async (chatId: string): Promise<Message[]> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return [];
    }
    
    // Get all messages
    const allMessages = messagesDb.get('');
    
    // Filter messages for the specified chat
    const chatMessages = allMessages
      .filter((msg: any) => msg.chatId === chatId)
      .map((msg: any) => {
        const { _id, savedAt, ...messageData } = msg; // Remove _id and savedAt
        return messageData as Message;
      });
    
    // Sort by timestamp
    return chatMessages.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error getting chat messages from OrbitDB:', error);
    return [];
  }
};

/**
 * Get a single chat by ID
 */
export const getChat = async (chatId: string): Promise<Chat | null> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return null;
    }
    
    // Get the chat
    const chats = chatsDb.get(chatId);
    if (chats.length === 0) return null;
    
    const { _id, ...chatData } = chats[0];
    return chatData as Chat;
  } catch (error) {
    console.error('Error getting chat from OrbitDB:', error);
    return null;
  }
};

/**
 * Delete a message from the database
 */
export const deleteMessage = async (messageId: string): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return false;
    }
    
    await messagesDb.del(messageId);
    return true;
  } catch (error) {
    console.error('Error deleting message from OrbitDB:', error);
    return false;
  }
};

/**
 * Delete a chat and all its messages
 */
export const deleteChat = async (chatId: string): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return false;
    }
    
    // First, delete the chat
    await chatsDb.del(chatId);
    
    // Then, get all messages for this chat
    const allMessages = messagesDb.get('');
    const chatMessages = allMessages.filter((msg: any) => msg.chatId === chatId);
    
    // Delete each message
    for (const message of chatMessages) {
      await messagesDb.del(message._id);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting chat from OrbitDB:', error);
    return false;
  }
};

/**
 * Sync the local message store with OrbitDB
 */
export const syncMessagesWithOrbitDB = async (): Promise<boolean> => {
  try {
    if (!isInitialized) {
      const success = await initMessageDB();
      if (!success) return false;
    }
    
    // Import the stores dynamically to avoid circular dependencies
    const { useMessageStore } = await import('@/store/messageStore');
    const messageStore = useMessageStore.getState();
    
    // Step 1: Sync chats
    const storeChats = messageStore.chats;
    const orbitChats = await getAllChats();
    
    // Create maps for easier lookup
    const storeChatsMap = new Map(Object.entries(storeChats));
    const orbitChatsMap = new Map(orbitChats.map(chat => [chat.id, chat]));
    
    // Chats in OrbitDB but not in store
    let addedChatsCount = 0;
    for (const [chatId, orbitChat] of orbitChatsMap.entries()) {
      if (!storeChatsMap.has(chatId)) {
        // Add to store
        useMessageStore.setState(state => ({
          chats: {
            ...state.chats,
            [chatId]: orbitChat
          }
        }));
        addedChatsCount++;
      }
    }
    
    // Chats in store but not in OrbitDB
    let syncedChatsCount = 0;
    for (const [chatId, storeChat] of storeChatsMap.entries()) {
      if (!orbitChatsMap.has(chatId)) {
        // Add to OrbitDB
        await saveChat(storeChat);
        syncedChatsCount++;
      }
    }
    
    // Step 2: Sync messages
    const storeMessages = messageStore.messages;
    
    // Messages in store but not in OrbitDB
    let syncedMessagesCount = 0;
    for (const [chatId, chatMessages] of Object.entries(storeMessages)) {
      // Get orbit messages for this chat
      const orbitMessages = await getChatMessages(chatId);
      const orbitMessageIds = new Set(orbitMessages.map(msg => msg.id));
      
      // Find messages that need to be synced
      for (const message of chatMessages) {
        if (!orbitMessageIds.has(message.id)) {
          await saveMessage(message);
          syncedMessagesCount++;
        }
      }
    }
    
    // Messages in OrbitDB but not in store
    let addedMessagesCount = 0;
    const orbitChatsArray = Array.from(orbitChatsMap.keys());
    
    for (const chatId of orbitChatsArray) {
      const orbitMessages = await getChatMessages(chatId);
      const storeMessagesForChat = storeMessages[chatId] || [];
      const storeMessageIds = new Set(storeMessagesForChat.map(msg => msg.id));
      
      // Find messages that need to be added to store
      const newMessages = orbitMessages.filter(msg => !storeMessageIds.has(msg.id));
      
      if (newMessages.length > 0) {
        // Add to store
        useMessageStore.setState(state => ({
          messages: {
            ...state.messages,
            [chatId]: [...(state.messages[chatId] || []), ...newMessages].sort(
              (a, b) => a.timestamp - b.timestamp
            )
          }
        }));
        addedMessagesCount += newMessages.length;
      }
    }
    
    console.log(`Synced with OrbitDB: added ${addedChatsCount} chats and ${addedMessagesCount} messages to store, synced ${syncedChatsCount} chats and ${syncedMessagesCount} messages to OrbitDB`);
    return true;
  } catch (error) {
    console.error('Error syncing with OrbitDB:', error);
    return false;
  }
};

/**
 * Close the OrbitDB databases
 */
export const closeMessageDB = async (): Promise<void> => {
  if (!isInitialized) return;
  
  try {
    if (messagesDb) await messagesDb.close();
    if (chatsDb) await chatsDb.close();
    if (orbitdb) await orbitdb.stop();
    
    isInitialized = false;
    console.log('Messages OrbitDB databases closed');
  } catch (error) {
    console.error('Error closing Messages OrbitDB:', error);
  }
}; 