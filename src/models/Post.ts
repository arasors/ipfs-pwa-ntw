import type { CID } from 'multiformats/cid';

// Define post visibility options
export type PostVisibility = 'public' | 'followers' | 'private';

// Interface representing a media item
export interface MediaItem {
  contentCID?: string;
  type: 'image' | 'video' | 'document';
}

export interface Post {
  id: string;
  content: string;
  authorAddress: string;
  authorName?: string;
  timestamp: number;
  contentCID?: CID | string;
  likes: number;
  comments: Comment[];
  reposts: number;
  // Legacy single media support
  mediaContentCID?: CID | string;
  mediaType?: 'image' | 'video' | 'audio';
  // New multiple media support
  mediaItems?: MediaItem[];
  tags?: string[];
  // Category information
  category?: string;
  // Privacy controls
  visibility: PostVisibility;
  encryptionKey?: string; // For encrypted private content
  allowedAddresses?: string[]; // Specific addresses that can view private content
}

export interface Comment {
  id: string;
  content: string;
  authorAddress: string;
  authorName?: string;
  timestamp: number;
  contentCID?: CID | string;
  likes: number;
  replies?: Comment[];
  // Privacy-related fields
  isPrivate?: boolean;
  parentPostVisibility?: PostVisibility;
}

// Reference to the User model in models/User.ts
// This interface was moved to User.ts
export interface User {
  address: string;
}

// IPFS post data to be stored on IPFS
export interface IPFSPost {
  content: string;
  authorAddress: string;
  authorName?: string;
  timestamp: number;
  // Legacy single media support
  mediaContentCID?: string;
  mediaType?: 'image' | 'video' | 'audio';
  // New multiple media support
  mediaItems?: MediaItem[];
  tags?: string[];
  // Category information
  category?: string;
  // Privacy controls
  visibility: PostVisibility;
  encryptionKey?: string;
  allowedAddresses?: string[];
} 