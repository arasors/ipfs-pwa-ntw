"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Chat, Message } from '@/models/Message';
import { useNotificationStore } from './notificationStore';
import { saveChat, saveMessage } from '@/lib/orbitdb-messages';

export interface MessageState {
  chats: Record<string, Chat>;
  messages: Record<string, Message[]>;
  selectedChatId: string | null;
  
  // Actions
  fetchChats: () => Promise<void>;
  getChat: (chatId: string) => Chat | undefined;
  getChatMessages: (chatId: string) => Message[];
  getOrCreateChat: (participantAddress: string) => Chat;
  selectChat: (chatId: string) => void;
  sendMessage: (params: {
    chatId: string;
    content: string;
    mediaItems?: { cid: string; mimeType: string }[];
  }) => Promise<void>;
  markMessagesAsRead: (chatId: string) => void;
  
  // New actions for deleting and editing
  deleteMessage: (chatId: string, messageId: string) => void;
  deleteChat: (chatId: string) => void;
  editMessage: (chatId: string, messageId: string, newContent: string) => void;
  getMessageEditHistory: (chatId: string, messageId: string) => { content: string; timestamp: number; }[] | null;
}

export const useMessageStore = create<MessageState>()(
  persist(
    (set, get) => ({
      chats: {},
      messages: {},
      selectedChatId: null,
      
      fetchChats: async () => {
        // In a real app, this would fetch from an API
        // For now, we'll just use the persisted data
        console.log('Fetched chats');
      },
      
      getChat: (chatId: string) => {
        return get().chats[chatId];
      },
      
      getChatMessages: (chatId: string) => {
        return get().messages[chatId] || [];
      },
      
      getOrCreateChat: (participantAddress: string) => {
        const { chats } = get();
        const currentUserAddress = localStorage.getItem('walletAddress');
        
        if (!currentUserAddress) {
          throw new Error('User not authenticated');
        }
        
        // Special handling for self-messaging (messaging yourself)
        const isSelfMessage = participantAddress === currentUserAddress;
        
        // For self messaging, create a special format or check if it already exists
        if (isSelfMessage) {
          // Look for an existing self-chat
          const existingSelfChat = Object.values(chats).find(chat => 
            chat.participants.length === 2 && 
            chat.participants[0] === currentUserAddress && 
            chat.participants[1] === currentUserAddress
          );
          
          if (existingSelfChat) {
            return existingSelfChat;
          }
          
          // Create a new self-chat
          const newChatId = uuidv4();
          const newChat: Chat = {
            id: newChatId,
            participants: [currentUserAddress, currentUserAddress], // Add yourself twice to indicate self-chat
            unreadCount: 0
          };
          
          set(state => ({
            chats: {
              ...state.chats,
              [newChatId]: newChat
            },
            messages: {
              ...state.messages,
              [newChatId]: []
            }
          }));
          
          // Yeni sohbeti OrbitDB'ye kaydet
          saveChat(newChat).catch(error => 
            console.error('Error saving new self-chat to OrbitDB:', error)
          );
          
          return newChat;
        }
        
        // Normal chat between two different users
        // Check if chat already exists
        const existingChat = Object.values(chats).find(chat => 
          chat.participants.length === 2 &&
          chat.participants.includes(currentUserAddress) && 
          chat.participants.includes(participantAddress)
        );
        
        if (existingChat) {
          return existingChat;
        }
        
        // Create new chat
        const newChatId = uuidv4();
        const newChat: Chat = {
          id: newChatId,
          participants: [currentUserAddress, participantAddress],
          unreadCount: 0
        };
        
        set(state => ({
          chats: {
            ...state.chats,
            [newChatId]: newChat
          },
          messages: {
            ...state.messages,
            [newChatId]: []
          }
        }));
        
        // Yeni sohbeti OrbitDB'ye kaydet
        saveChat(newChat).catch(error => 
          console.error('Error saving new chat to OrbitDB:', error)
        );
        
        return newChat;
      },
      
      selectChat: (chatId: string) => {
        set({ selectedChatId: chatId });
        // Mark messages as read when selecting chat
        get().markMessagesAsRead(chatId);
      },
      
      sendMessage: async ({ chatId, content, mediaItems = [] }) => {
        const { chats, messages } = get();
        const chat = chats[chatId];
        
        if (!chat) {
          throw new Error('Chat not found');
        }
        
        const currentUserAddress = localStorage.getItem('walletAddress');
        if (!currentUserAddress) {
          throw new Error('User not authenticated');
        }
        
        const newMessage: Message = {
          id: uuidv4(),
          chatId,
          senderAddress: currentUserAddress,
          content,
          timestamp: Date.now(),
          read: false,
          mediaItems
        };
        
        // In a real app, we'd send this to an API/backend
        
        // Update messages
        const updatedMessages = {
          ...messages,
          [chatId]: [...(messages[chatId] || []), newMessage]
        };
        
        // Update chat with last message
        const updatedChats = {
          ...chats,
          [chatId]: {
            ...chat,
            lastMessage: {
              content: content || (mediaItems.length > 0 ? 'Sent media' : ''),
              timestamp: newMessage.timestamp,
              senderAddress: currentUserAddress
            }
          }
        };
        
        // For the recipient, increment their unread count
        const recipientAddress = chat.participants.find(p => p !== currentUserAddress);
        
        // We would normally handle this server-side
        // This is just for the demo
        
        set({
          messages: updatedMessages,
          chats: updatedChats
        });
        
        // Mesajı OrbitDB'ye kaydet
        saveMessage(newMessage).catch(error => 
          console.error('Error saving message to OrbitDB:', error)
        );
        
        // Güncellenmiş sohbeti OrbitDB'ye kaydet
        saveChat(updatedChats[chatId]).catch(error => 
          console.error('Error saving updated chat to OrbitDB:', error)
        );
        
        // Use notification system to notify recipient
        const notificationStore = useNotificationStore.getState();
        notificationStore.addNotification({
          type: 'system',
          title: 'New Message',
          message: `You have a new message from ${currentUserAddress}`,
          recipientAddress: recipientAddress
        });
        
        return Promise.resolve();
      },
      
      markMessagesAsRead: (chatId: string) => {
        const { messages, chats } = get();
        const chatMessages = messages[chatId] || [];
        const chat = chats[chatId];
        
        if (!chat) return;
        
        const currentUserAddress = localStorage.getItem('walletAddress');
        if (!currentUserAddress) return;
        
        // Only mark messages from other participants as read
        const updatedMessages = chatMessages.map(message => 
          message.senderAddress !== currentUserAddress && !message.read
            ? { ...message, read: true }
            : message
        );
        
        // Reset unread count for the current user
        const updatedChat = {
          ...chat,
          unreadCount: 0
        };
        
        set(state => ({
          messages: {
            ...state.messages,
            [chatId]: updatedMessages
          },
          chats: {
            ...state.chats,
            [chatId]: updatedChat
          }
        }));
        
        // Okundu olarak işaretlenen mesajları OrbitDB'ye kaydet
        updatedMessages.forEach(message => {
          if (message.read) {
            saveMessage(message).catch(error => 
              console.error(`Error saving read status for message ${message.id} to OrbitDB:`, error)
            );
          }
        });
        
        // Güncellenen sohbeti OrbitDB'ye kaydet
        saveChat(updatedChat).catch(error => 
          console.error(`Error saving updated chat ${chatId} to OrbitDB:`, error)
        );
      },
      
      deleteMessage: (chatId: string, messageId: string) => {
        const { messages, chats } = get();
        const chatMessages = messages[chatId] || [];
        const chat = chats[chatId];
        
        if (!chat || !chatMessages.length) return;
        
        // Filter out the message to delete
        const updatedMessages = chatMessages.filter(message => message.id !== messageId);
        
        // Update the last message if needed
        let updatedChat = { ...chat };
        
        // If we're deleting the last message, update the lastMessage property
        if (chatMessages.length > 0 && 
            chatMessages[chatMessages.length - 1].id === messageId && 
            updatedMessages.length > 0) {
          
          const newLastMessage = updatedMessages[updatedMessages.length - 1];
          updatedChat = {
            ...chat,
            lastMessage: {
              content: newLastMessage.content || (newLastMessage.mediaItems?.length ? 'Sent media' : ''),
              timestamp: newLastMessage.timestamp,
              senderAddress: newLastMessage.senderAddress
            }
          };
        }
        
        // If all messages are deleted, clear lastMessage
        if (updatedMessages.length === 0) {
          updatedChat = {
            ...chat,
            lastMessage: undefined
          };
        }
        
        set(state => ({
          messages: {
            ...state.messages,
            [chatId]: updatedMessages
          },
          chats: {
            ...state.chats,
            [chatId]: updatedChat
          }
        }));
      },
      
      deleteChat: (chatId: string) => {
        const { chats, messages, selectedChatId } = get();
        
        // Create a new chats object without the deleted chat
        const { [chatId]: deletedChat, ...remainingChats } = chats;
        
        // Create a new messages object without the messages from deleted chat
        const { [chatId]: deletedMessages, ...remainingMessages } = messages;
        
        // Update selected chat if needed
        const newSelectedChatId = selectedChatId === chatId ? null : selectedChatId;
        
        set({
          chats: remainingChats,
          messages: remainingMessages,
          selectedChatId: newSelectedChatId
        });
      },
      
      editMessage: (chatId: string, messageId: string, newContent: string) => {
        const { messages, chats } = get();
        const chatMessages = messages[chatId] || [];
        const chat = chats[chatId];
        
        if (!chat || !chatMessages.length) return;
        
        // Find the message to edit
        const messageIndex = chatMessages.findIndex(message => message.id === messageId);
        if (messageIndex === -1) return;
        
        const message = chatMessages[messageIndex];
        
        // Make sure the user can only edit their own messages
        const currentUserAddress = localStorage.getItem('walletAddress');
        if (message.senderAddress !== currentUserAddress) return;
        
        // Store the original message in edit history
        const editHistory = message.editHistory || [];
        editHistory.push({
          content: message.content,
          timestamp: Date.now()
        });
        
        // Create the updated message
        const updatedMessage: Message = {
          ...message,
          content: newContent,
          isEdited: true,
          editHistory
        };
        
        // Update the messages array
        const updatedMessages = [...chatMessages];
        updatedMessages[messageIndex] = updatedMessage;
        
        // Update the last message if needed
        let updatedChat = { ...chat };
        if (chatMessages.length > 0 && 
            chatMessages[chatMessages.length - 1].id === messageId) {
          
          updatedChat = {
            ...chat,
            lastMessage: {
              content: newContent || (updatedMessage.mediaItems?.length ? 'Sent media' : ''),
              timestamp: message.timestamp,
              senderAddress: message.senderAddress
            }
          };
        }
        
        set(state => ({
          messages: {
            ...state.messages,
            [chatId]: updatedMessages
          },
          chats: {
            ...state.chats,
            [chatId]: updatedChat
          }
        }));
      },
      
      getMessageEditHistory: (chatId: string, messageId: string) => {
        const { messages } = get();
        const chatMessages = messages[chatId] || [];
        
        const message = chatMessages.find(message => message.id === messageId);
        if (!message || !message.editHistory) return null;
        
        return message.editHistory;
      }
    }),
    {
      name: 'message-store',
    }
  )
); 