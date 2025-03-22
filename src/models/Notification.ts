import type { CID } from 'multiformats/cid';

export type NotificationType = 
  | 'like'      // Post liked
  | 'comment'   // Comment on post
  | 'follow'    // User followed
  | 'mention'   // User mentioned in a post
  | 'repost'    // Post reposted
  | 'system';   // System notification

export interface Notification {
  id: string;
  type: NotificationType;
  timestamp: number;
  isRead: boolean;
  
  // Associated user
  actorAddress?: string;
  actorName?: string;
  
  // Recipient user
  recipientAddress?: string;
  
  // Notification content
  title: string;
  message: string;
  
  // Related entity references
  postId?: string;
  postContentCID?: CID | string;
  commentId?: string;
  
  // Additional data
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  mentions: boolean;
  follows: boolean;
  reposts: boolean;
  system: boolean;
  emailNotifications: boolean;
}

export const DefaultNotificationPreferences: NotificationPreferences = {
  likes: true,
  comments: true,
  mentions: true, 
  follows: true,
  reposts: true,
  system: true,
  emailNotifications: false
}; 