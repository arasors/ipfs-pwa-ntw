import type { CID } from 'multiformats/cid';

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

export interface MessageMedia {
  contentCID: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name?: string;
  size?: number;
  mimeType?: string;
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

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'; 