// User types
export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  bio?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  memberSince?: string;
}

// Room types
export type RoomType = 'direct' | 'group' | 'public';
export type MemberRole = 'admin' | 'moderator' | 'member';

export interface RoomMember {
  user: User;
  role: MemberRole;
  joinedAt: string;
  lastReadAt: string;
}

export interface Room {
  _id: string;
  name: string;
  description?: string;
  type: RoomType;
  avatar?: string;
  creator: User;
  members: RoomMember[];
  settings: {
    isPrivate: boolean;
    allowInvites: boolean;
    maxMembers: number;
  };
  memberCount: number;
  lastActivity: string;
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
  userRole?: MemberRole;
  otherUser?: User; // For direct messages
}

// Message types
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface MessageReadBy {
  user: string;
  readAt: string;
}

export interface MessageMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileUrl?: string;
  systemType?: 'user_joined' | 'user_left' | 'room_created' | 'user_promoted' | 'user_demoted';
  replyTo?: string;
  editedAt?: string;
  editHistory?: Array<{
    content: string;
    editedAt: string;
  }>;
}

export interface Message {
  _id: string;
  content: string;
  sender: User;
  room: string;
  type: MessageType;
  metadata?: MessageMetadata;
  reactions: MessageReaction[];
  readBy: MessageReadBy[];
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  tempId?: string; // For optimistic updates
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  data: T & {
    pagination: PaginationInfo;
  };
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUser extends User {
  // Additional auth-specific fields if needed
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

// Socket event types
export interface SocketEvents {
  // Connection events
  'connection:established': {
    userId: string;
    user: User;
    connectedAt: string;
    activeUsers: Array<{
      userId: string;
      username: string;
      avatar?: string;
      status: string;
      connectedAt: string;
    }>;
  };

  // Message events
  'message:new': Message;
  'message:sent': {
    tempId?: string;
    message: Message;
  };
  'message:edited': {
    messageId: string;
    content: string;
    editedAt: string;
    editHistory: Array<{
      content: string;
      editedAt: string;
    }>;
  };
  'message:deleted': {
    messageId: string;
    deletedBy: string;
    deletedAt: string;
  };
  'message:reaction:added': {
    messageId: string;
    emoji: string;
    userId: string;
    username: string;
    reactions: MessageReaction[];
  };
  'message:reaction:removed': {
    messageId: string;
    emoji: string;
    userId: string;
    username: string;
    reactions: MessageReaction[];
  };
  'messages:read': {
    userId: string;
    roomId: string;
    readAt: string;
    messageIds: string[];
  };

  // Typing events
  'typing:start': {
    userId: string;
    username: string;
    roomId: string;
  };
  'typing:stop': {
    userId: string;
    username: string;
    roomId: string;
  };

  // Room events
  'room:joined': {
    room: Room;
  };
  'room:left': {
    roomId: string;
  };
  'room:created': {
    room: Room;
  };
  'room:direct_created': {
    room: Room;
    otherUser: User;
  };
  'room:user_joined': {
    roomId: string;
    user: User;
    joinedAt: string;
  };
  'room:user_left': {
    roomId: string;
    user: User;
    leftAt: string;
  };
  'room:member_added': {
    roomId: string;
    newMember: RoomMember;
    invitedBy: User;
  };
  'room:member_removed': {
    roomId: string;
    removedMember: {
      _id: string;
      username: string;
    };
    removedBy: User;
  };
  'room:role_updated': {
    roomId: string;
    member: {
      _id: string;
      username: string;
      newRole: MemberRole;
    };
    updatedBy: User;
  };
  'room:invitation': {
    room: {
      _id: string;
      name: string;
      type: RoomType;
      avatar?: string;
    };
    invitedBy: User;
  };

  // User events
  'user:status': {
    userId: string;
    status: string;
    lastSeen: string;
  };
  'user:friend_added': {
    friend: User;
    addedAt: string;
  };
  'user:friend_removed': {
    removedBy: User;
  };

  // Error events
  error: {
    message: string;
    tempId?: string;
  };
}

// Chat state types
export interface ChatState {
  currentRoom: Room | null;
  rooms: Room[];
  messages: Record<string, Message[]>;
  onlineUsers: User[];
  typingUsers: Record<string, string[]>; // roomId -> usernames
  unreadCounts: Record<string, number>; // roomId -> count
}

// UI state types
export interface UIState {
  sidebarOpen: boolean;
  currentView: 'chat' | 'profile' | 'settings';
  theme: 'light' | 'dark';
  notifications: boolean;
}

// Form types
export interface MessageForm {
  content: string;
  type?: MessageType;
  replyTo?: string;
}

export interface RoomForm {
  name: string;
  description?: string;
  type: RoomType;
  isPrivate?: boolean;
  maxMembers?: number;
}

export interface ProfileForm {
  username: string;
  bio?: string;
  avatar?: string;
}

// Utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Search types
export interface SearchResult {
  users: User[];
  rooms: Room[];
  messages: Message[];
}

// Notification types
export interface Notification {
  id: string;
  type: 'message' | 'invitation' | 'friend_request' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

