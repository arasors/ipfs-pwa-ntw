import { MessageState } from '@/store/messageStore';
import { syncMessagesWithOrbitDB, initMessageDB } from './orbitdb-messages';

// Arka arkaya istekler göndermemek için son senkronizasyon zamanını tutuyoruz
let lastSyncTimeGlobal = 0;
const MIN_SYNC_INTERVAL = 5000; // 5 saniye

/**
 * Mesajları hem API hem de OrbitDB ile senkronize eder
 * @param lastSyncTime Son senkronizasyonun zaman damgası
 * @returns Güncel senkronizasyonun zaman damgası
 */
export const syncMessages = async (lastSyncTime: number = 0): Promise<number> => {
  try {
    const now = Date.now();
    
    // Eğer son senkronizasyondan bu yana çok az zaman geçtiyse, senkronizasyonu atla
    if (now - lastSyncTimeGlobal < MIN_SYNC_INTERVAL) {
      console.log('Skipping message sync - too soon since last sync');
      return lastSyncTime;
    }
    
    lastSyncTimeGlobal = now;
    
    // Get current user address
    const currentUserAddress = localStorage.getItem('walletAddress');
    if (!currentUserAddress) {
      console.error('User not authenticated');
      return lastSyncTime;
    }

    // Import the message store dynamically to avoid circular dependencies
    const { useMessageStore } = await import('@/store/messageStore');
    
    // Get current state from the store
    const messageStore = useMessageStore.getState();
    
    // Adım 1: OrbitDB ile senkronizasyon yap
    console.log('Synchronizing messages with OrbitDB...');
    await initMessageDB(); // OrbitDB'yi başlat
    await syncMessagesWithOrbitDB(); // OrbitDB ile senkronize et
    
    // Adım 2: API ile mesajları senkronize et (eski yöntem - geçiş döneminde)
    // API sunucusuna yerel değişiklikleri gönder
    await pushMessagesToServer(messageStore, currentUserAddress);
    
    // API sunucusundan güncellemeleri al
    const currentSyncTime = await pullMessagesFromServer(messageStore, currentUserAddress, lastSyncTime);
    
    return currentSyncTime;
  } catch (error) {
    console.error('Error syncing messages:', error);
    return lastSyncTime;
  }
};

/**
 * Pushes local messages to the server
 */
const pushMessagesToServer = async (
  messageStore: MessageState, 
  userAddress: string
): Promise<void> => {
  try {
    const { chats, messages } = messageStore;
    
    // Send local state to the server
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chats,
        messages,
        userAddress
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to push messages: ${response.statusText}`);
    }
    
    console.log('Successfully pushed messages to server');
  } catch (error) {
    console.error('Error pushing messages to server:', error);
  }
};

/**
 * Pulls remote messages from the server
 * @returns timestamp of the current sync
 */
const pullMessagesFromServer = async (
  messageStore: MessageState, 
  userAddress: string,
  lastSyncTime: number
): Promise<number> => {
  try {
    // Fetch remote state from the server
    const response = await fetch(`/api/messages?userAddress=${userAddress}&since=${lastSyncTime}`);
    
    if (!response.ok) {
      throw new Error(`Failed to pull messages: ${response.statusText}`);
    }
    
    const { chats, messages, timestamp } = await response.json();
    
    // Merge remote state with local state
    if (chats && Object.keys(chats).length > 0) {
      mergeRemoteChats(messageStore, chats);
    }
    
    if (messages && Object.keys(messages).length > 0) {
      mergeRemoteMessages(messageStore, messages);
    }
    
    console.log(`Successfully pulled messages from server, timestamp: ${timestamp}`);
    return timestamp;
  } catch (error) {
    console.error('Error pulling messages from server:', error);
    return Date.now(); // Return current time as fallback
  }
};

/**
 * Merges remote chats with local chats
 */
const mergeRemoteChats = async (
  messageStore: MessageState, 
  remoteChats: Record<string, any>
): Promise<void> => {
  // Import the store again to avoid stale references
  const { useMessageStore } = await import('@/store/messageStore');
  
  Object.entries(remoteChats).forEach(([chatId, remoteChat]) => {
    const localChat = messageStore.getChat(chatId);
    
    if (!localChat) {
      // New chat - update the local store
      useMessageStore.setState((state: MessageState) => ({
        chats: {
          ...state.chats,
          [chatId]: remoteChat
        }
      }));
    } else {
      // Existing chat - merge with local, preserving local changes
      // but updating with remote chat's lastMessage if it's more recent
      const mergedChat = {
        ...localChat,
        ...remoteChat,
        // For lastMessage, use the most recent one
        lastMessage: localChat.lastMessage && remoteChat.lastMessage
          ? remoteChat.lastMessage.timestamp > localChat.lastMessage.timestamp
            ? remoteChat.lastMessage
            : localChat.lastMessage
          : remoteChat.lastMessage || localChat.lastMessage,
        // Keep the higher unread count
        unreadCount: Math.max(
          localChat.unreadCount || 0,
          remoteChat.unreadCount || 0
        )
      };
      
      useMessageStore.setState((state: MessageState) => ({
        chats: {
          ...state.chats,
          [chatId]: mergedChat
        }
      }));
    }
  });
};

/**
 * Merges remote messages with local messages
 */
const mergeRemoteMessages = async (
  messageStore: MessageState, 
  remoteMessages: Record<string, any[]>
): Promise<void> => {
  // Import the store again to avoid stale references
  const { useMessageStore } = await import('@/store/messageStore');
  
  Object.entries(remoteMessages).forEach(([chatId, remoteChatMessages]) => {
    const localMessages = messageStore.getChatMessages(chatId);
    
    // Create a map of existing message IDs
    const existingMessageIds = new Set(localMessages.map(msg => msg.id));
    
    // Filter out messages we already have
    const newMessages = remoteChatMessages.filter(msg => !existingMessageIds.has(msg.id));
    
    if (newMessages.length > 0) {
      // Add new messages to our store
      useMessageStore.setState((state: MessageState) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), ...newMessages].sort(
            (a, b) => a.timestamp - b.timestamp
          )
        }
      }));
      
      console.log(`Added ${newMessages.length} new messages for chat ${chatId}`);
    }
  });
}; 