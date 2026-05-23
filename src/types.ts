import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  online: boolean;
  lastSeen: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  pinEnabled?: boolean;
  pinCode?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  avatarConfig?: AvatarConfig; // Premium avatar configuration
}

export type FileType = "image" | "pdf" | "audio" | "video" | "other";

export interface Message {
  id: string; // Document ID
  from: string;
  to: string;
  text: string | null;
  fileURL: string | null;
  fileType: FileType | null;
  fileName: string | null;
  timestamp: Timestamp;
  read: boolean;
  
  // Custom smart messaging keys
  isEdited?: boolean;
  originalText?: string;
  editedAt?: Timestamp;
  isDeleted?: boolean;
  isStarred?: boolean;
  isViewOnce?: boolean;
  isViewOnceOpened?: boolean;
  voiceTranscript?: string;
  isTranscriptLoading?: boolean;
  disappearingTimer?: number; // expiration duration in ms, e.g. 24*60*60*1000
  replyToMessage?: {
    id: string;
    text: string | null;
    fileName: string | null;
    sender: string;
  };
  reactions?: Record<string, string>; // userId: emoji mapping
}

export interface ChatRoom {
  id: string; // Format: uid1_uid2 sorted
  participants: string[];
  lastMessage: string;
  lastMessageTimestamp: Timestamp;
  unreadCount?: {
    [userId: string]: number;
  };
  typing?: {
    [userId: string]: any;
  };
  pinnedUsers?: string[]; // list of uids who pinned this chat room
  disappearingSetting?: number; // in hours: 0, 24, 168 (7 days), 2160 (90 days)
  lockedBy?: string[]; // uids of users who locked this chat room
}

export interface AvatarConfig {
  bgColor: string;
  hairStyle: string;
  hairColor: string;
  eyesType: string;
  shirtColor: string;
  accessory: string;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  description: string;
  logo: string;
  followers: number;
  updates: ChannelUpdate[];
  followedByUser: boolean;
}

export interface ChannelUpdate {
  id: string;
  text: string;
  mediaUrl?: string;
  timestamp: string;
  likes: number;
}
