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

// Global pubsub topic handlers for compatibility layer
interface PubSubTopics {
  [topic: string]: Function[];
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ipfsPubSubTopics?: PubSubTopics;
  }
}

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
 * Helia'yı OrbitDB için js-ipfs API'sine uygun şekilde sarmalayan yardımcı fonksiyon
 * OrbitDB, Helia'nın yeni API'si yerine eski js-ipfs API'sine göre çalışır
 */
const wrapHeliaWithIpfsCompat = (helia: any) => {
  if (!helia) return null;
  
  // OrbitDB'nin beklediği ipfs.id() fonksiyonunu ekle
  const wrappedHelia = {
    ...helia,
    id: async () => {
      // Helia'da id fonksiyonu yok, orbitdb için sahte bir id objesi döndür
      return {
        id: `helia-${Date.now()}`,
        publicKey: "placeholder-public-key",
        addresses: [],
        agentVersion: "Helia/1.0"
      };
    },
    pubsub: {
      // OrbitDB, ipfs.pubsub API'sine ihtiyaç duyar
      subscribe: async (topic: string, handler: Function) => {
        console.log(`[IPFS Compat] Subscribing to topic: ${topic}`);
        // Basit bir pubsub implementasyonu
        if (!window.ipfsPubSubTopics) {
          window.ipfsPubSubTopics = {};
        }
        if (!window.ipfsPubSubTopics[topic]) {
          window.ipfsPubSubTopics[topic] = [];
        }
        window.ipfsPubSubTopics[topic].push(handler);
        return Promise.resolve();
      },
      unsubscribe: async (topic: string) => {
        console.log(`[IPFS Compat] Unsubscribing from topic: ${topic}`);
        // Basit temizleme
        if (window.ipfsPubSubTopics && window.ipfsPubSubTopics[topic]) {
          delete window.ipfsPubSubTopics[topic];
        }
        return Promise.resolve();
      },
      publish: async (topic: string, data: Uint8Array) => {
        console.log(`[IPFS Compat] Publishing to topic: ${topic}`);
        // Basit yayın mekanizması
        if (window.ipfsPubSubTopics && window.ipfsPubSubTopics[topic]) {
          window.ipfsPubSubTopics[topic].forEach((handler: Function) => {
            handler(data);
          });
        }
        return Promise.resolve();
      }
    },
    dag: {
      put: async (data: any) => {
        console.log("[IPFS Compat] DAG put operation requested");
        // OrbitDB'nin DAG API ihtiyaçları için basit bir cevap
        return { cid: { toString: () => `dag-${Date.now()}` } };
      },
      get: async (cid: any) => {
        console.log("[IPFS Compat] DAG get operation requested");
        return { value: {} };
      }
    }
  };
  
  console.log("Helia wrapped with js-ipfs compatibility layer for OrbitDB");
  return wrappedHelia;
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
    
    // Helia'yı js-ipfs uyumlu sarmalayıcı ile OrbitDB için hazırla
    const ipfsCompat = wrapHeliaWithIpfsCompat(helia);
    if (!ipfsCompat) {
      console.error('Failed to create IPFS compatibility layer');
      isInitializing = false;
      return false;
    }
    
    // Create OrbitDB instance with wrapped Helia
    orbitdb = await OrbitDB.createInstance(ipfsCompat);
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
    
    // Detaylı log ekleyelim
    console.log(`Syncing: Found ${Object.keys(storeChats).length} local chats and ${orbitChats.length} remote chats`);
    
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
        console.log(`Added new chat from OrbitDB: ${chatId} with participants:`, orbitChat.participants);
      }
      
      // Katılımcılara göre sohbetleri kontrol et
      // Kullanıcı bir sohbete katılımcı olarak eklenmiş olabilir
      if (!storeChatsMap.has(chatId)) {
        const currentUserAddress = localStorage.getItem('walletAddress');
        if (currentUserAddress && orbitChat.participants.includes(currentUserAddress)) {
          console.log(`User ${currentUserAddress} is a participant in chat ${chatId}, adding to local store`);
          useMessageStore.setState(state => ({
            chats: {
              ...state.chats,
              [chatId]: orbitChat
            }
          }));
          addedChatsCount++;
        }
      }
    }
    
    // Chats in store but not in OrbitDB
    let syncedChatsCount = 0;
    for (const [chatId, storeChat] of storeChatsMap.entries()) {
      if (!orbitChatsMap.has(chatId)) {
        // Add to OrbitDB
        await saveChat(storeChat);
        syncedChatsCount++;
        console.log(`Added local chat to OrbitDB: ${chatId} with participants:`, storeChat.participants);
      }
    }
    
    // Step 2: Sync messages
    const storeMessages = messageStore.messages;
    
    // Pull all messages for all chats (even if we don't have messages locally yet)
    let addedMessagesCount = 0;
    for (const chatId of [...orbitChatsMap.keys(), ...storeChatsMap.keys()]) {
      const orbitMessages = await getChatMessages(chatId);
      console.log(`Found ${orbitMessages.length} messages in OrbitDB for chat ${chatId}`);
      
      const storeMessagesForChat = storeMessages[chatId] || [];
      const storeMessageIds = new Set(storeMessagesForChat.map(msg => msg.id));
      
      // Yeni mesajları bul
      const newMessages = orbitMessages.filter(msg => !storeMessageIds.has(msg.id));
      
      if (newMessages.length > 0) {
        // Yerel store'a ekle
        useMessageStore.setState(state => ({
          messages: {
            ...state.messages,
            [chatId]: [...(state.messages[chatId] || []), ...newMessages].sort(
              (a, b) => a.timestamp - b.timestamp
            )
          }
        }));
        
        // Eğer chat seçili değilse, okunmamış mesaj sayacını artır
        const selectedChatId = messageStore.selectedChatId;
        const currentUserAddress = localStorage.getItem('walletAddress');
        
        // Başka bir kullanıcıdan gelen yeni mesajları say
        const unreadCount = newMessages.filter(
          msg => msg.senderAddress !== currentUserAddress
        ).length;
        
        if (unreadCount > 0 && chatId !== selectedChatId) {
          const chat = storeChats[chatId] || orbitChatsMap.get(chatId);
          if (chat) {
            useMessageStore.setState(state => ({
              chats: {
                ...state.chats,
                [chatId]: {
                  ...state.chats[chatId],
                  unreadCount: (state.chats[chatId]?.unreadCount || 0) + unreadCount,
                  // Son mesajı da güncelle
                  lastMessage: newMessages[newMessages.length - 1] ? {
                    content: newMessages[newMessages.length - 1].content,
                    timestamp: newMessages[newMessages.length - 1].timestamp,
                    senderAddress: newMessages[newMessages.length - 1].senderAddress
                  } : state.chats[chatId]?.lastMessage
                }
              }
            }));
          }
        }
        
        addedMessagesCount += newMessages.length;
        console.log(`Added ${newMessages.length} new messages for chat ${chatId}`);
      }
    }
    
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