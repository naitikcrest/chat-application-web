import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Room, Message, User, ChatState } from '@/types';
import { roomsAPI, messagesAPI } from '@/lib/api';
import socketManager from '@/lib/socket';
import toast from 'react-hot-toast';

interface ChatStore extends ChatState {
  // Loading states
  roomsLoading: boolean;
  messagesLoading: boolean;
  
  // Actions
  setCurrentRoom: (room: Room | null) => void;
  addRoom: (room: Room) => void;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  removeRoom: (roomId: string) => void;
  
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  
  setOnlineUsers: (users: User[]) => void;
  updateUserStatus: (userId: string, status: string, lastSeen: string) => void;
  
  setTypingUsers: (roomId: string, users: string[]) => void;
  addTypingUser: (roomId: string, username: string) => void;
  removeTypingUser: (roomId: string, username: string) => void;
  
  setUnreadCount: (roomId: string, count: number) => void;
  incrementUnreadCount: (roomId: string) => void;
  clearUnreadCount: (roomId: string) => void;
  
  // API actions
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: string, page?: number) => Promise<void>;
  loadMoreMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, tempId?: string) => void;
  markMessagesAsRead: (roomId: string) => void;
  
  // Socket event handlers
  handleNewMessage: (message: Message) => void;
  handleMessageEdited: (data: { messageId: string; content: string; editedAt: string }) => void;
  handleMessageDeleted: (data: { messageId: string }) => void;
  handleUserJoined: (data: { roomId: string; user: User }) => void;
  handleUserLeft: (data: { roomId: string; user: User }) => void;
  
  // Utility actions
  reset: () => void;
}

const initialState: ChatState = {
  currentRoom: null,
  rooms: [],
  messages: {},
  onlineUsers: [],
  typingUsers: {},
  unreadCounts: {},
};

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    roomsLoading: false,
    messagesLoading: false,

    setCurrentRoom: (room) => {
      const state = get();
      
      // Leave previous room
      if (state.currentRoom) {
        socketManager.leaveRoom(state.currentRoom._id);
      }
      
      // Join new room
      if (room) {
        socketManager.joinRoom(room._id);
        // Clear unread count for the room
        get().clearUnreadCount(room._id);
        // Mark messages as read
        get().markMessagesAsRead(room._id);
      }
      
      set({ currentRoom: room });
    },

    addRoom: (room) => {
      set((state) => ({
        rooms: [room, ...state.rooms.filter(r => r._id !== room._id)],
      }));
    },

    updateRoom: (roomId, updates) => {
      set((state) => ({
        rooms: state.rooms.map(room =>
          room._id === roomId ? { ...room, ...updates } : room
        ),
        currentRoom: state.currentRoom?._id === roomId
          ? { ...state.currentRoom, ...updates }
          : state.currentRoom,
      }));
    },

    removeRoom: (roomId) => {
      set((state) => ({
        rooms: state.rooms.filter(room => room._id !== roomId),
        currentRoom: state.currentRoom?._id === roomId ? null : state.currentRoom,
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([id]) => id !== roomId)
        ),
        unreadCounts: Object.fromEntries(
          Object.entries(state.unreadCounts).filter(([id]) => id !== roomId)
        ),
        typingUsers: Object.fromEntries(
          Object.entries(state.typingUsers).filter(([id]) => id !== roomId)
        ),
      }));
    },

    addMessage: (message) => {
      set((state) => {
        const roomMessages = state.messages[message.room] || [];
        
        // Check if message already exists (avoid duplicates)
        const existingIndex = roomMessages.findIndex(m => m._id === message._id);
        
        let updatedMessages;
        if (existingIndex >= 0) {
          // Update existing message
          updatedMessages = [...roomMessages];
          updatedMessages[existingIndex] = message;
        } else {
          // Add new message in chronological order
          updatedMessages = [...roomMessages, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }

        return {
          messages: {
            ...state.messages,
            [message.room]: updatedMessages,
          },
        };
      });
    },

    updateMessage: (messageId, updates) => {
      set((state) => {
        const newMessages = { ...state.messages };
        
        Object.keys(newMessages).forEach(roomId => {
          const messageIndex = newMessages[roomId].findIndex(m => m._id === messageId);
          if (messageIndex >= 0) {
            newMessages[roomId] = [...newMessages[roomId]];
            newMessages[roomId][messageIndex] = {
              ...newMessages[roomId][messageIndex],
              ...updates,
            };
          }
        });

        return { messages: newMessages };
      });
    },

    removeMessage: (messageId) => {
      set((state) => {
        const newMessages = { ...state.messages };
        
        Object.keys(newMessages).forEach(roomId => {
          newMessages[roomId] = newMessages[roomId].filter(m => m._id !== messageId);
        });

        return { messages: newMessages };
      });
    },

    setOnlineUsers: (users) => {
      set({ onlineUsers: users });
    },

    updateUserStatus: (userId, status, lastSeen) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.map(user =>
          user._id === userId ? { ...user, status, lastSeen } : user
        ),
        rooms: state.rooms.map(room => ({
          ...room,
          members: room.members.map(member =>
            member.user._id === userId
              ? { ...member, user: { ...member.user, status, lastSeen } }
              : member
          ),
        })),
      }));
    },

    setTypingUsers: (roomId, users) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: users,
        },
      }));
    },

    addTypingUser: (roomId, username) => {
      set((state) => {
        const currentTyping = state.typingUsers[roomId] || [];
        if (!currentTyping.includes(username)) {
          return {
            typingUsers: {
              ...state.typingUsers,
              [roomId]: [...currentTyping, username],
            },
          };
        }
        return state;
      });
    },

    removeTypingUser: (roomId, username) => {
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: (state.typingUsers[roomId] || []).filter(u => u !== username),
        },
      }));
    },

    setUnreadCount: (roomId, count) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [roomId]: count,
        },
      }));
    },

    incrementUnreadCount: (roomId) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [roomId]: (state.unreadCounts[roomId] || 0) + 1,
        },
      }));
    },

    clearUnreadCount: (roomId) => {
      set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [roomId]: 0,
        },
      }));
    },

    loadRooms: async () => {
      try {
        set({ roomsLoading: true });
        const response = await roomsAPI.getUserRooms();
        
        if (response.success && response.data) {
          set({ rooms: response.data.rooms });
        } else {
          toast.error('Failed to load rooms');
        }
      } catch (error) {
        console.error('Load rooms error:', error);
        toast.error('Failed to load rooms');
      } finally {
        set({ roomsLoading: false });
      }
    },

    loadMessages: async (roomId, page = 1) => {
      try {
        set({ messagesLoading: true });
        const response = await messagesAPI.getRoomMessages(roomId, { page, limit: 50 });
        
        if (response.success && response.data) {
          set((state) => ({
            messages: {
              ...state.messages,
              [roomId]: response.data.messages,
            },
          }));
        } else {
          toast.error('Failed to load messages');
        }
      } catch (error) {
        console.error('Load messages error:', error);
        toast.error('Failed to load messages');
      } finally {
        set({ messagesLoading: false });
      }
    },

    loadMoreMessages: async (roomId) => {
      try {
        const state = get();
        const currentMessages = state.messages[roomId] || [];
        const page = Math.floor(currentMessages.length / 50) + 1;
        
        const response = await messagesAPI.getRoomMessages(roomId, { page, limit: 50 });
        
        if (response.success && response.data && response.data.messages.length > 0) {
          set((state) => ({
            messages: {
              ...state.messages,
              [roomId]: [...response.data.messages, ...currentMessages],
            },
          }));
        }
      } catch (error) {
        console.error('Load more messages error:', error);
        toast.error('Failed to load more messages');
      }
    },

    sendMessage: (roomId, content, tempId) => {
      const messageData = {
        roomId,
        content,
        type: 'text' as const,
        tempId,
      };
      
      socketManager.sendMessage(messageData);
    },

    markMessagesAsRead: (roomId) => {
      socketManager.markMessagesAsRead(roomId);
    },

    // Socket event handlers
    handleNewMessage: (message) => {
      const state = get();
      
      // Add message to store
      get().addMessage(message);
      
      // If message is not from current room, increment unread count
      if (state.currentRoom?._id !== message.room) {
        get().incrementUnreadCount(message.room);
      }
      
      // Update room's last message and activity
      get().updateRoom(message.room, {
        lastMessage: message,
        lastActivity: message.createdAt,
      });
    },

    handleMessageEdited: (data) => {
      get().updateMessage(data.messageId, {
        content: data.content,
        metadata: {
          editedAt: data.editedAt,
        },
      });
    },

    handleMessageDeleted: (data) => {
      get().updateMessage(data.messageId, {
        isDeleted: true,
        content: 'This message has been deleted',
      });
    },

    handleUserJoined: (data) => {
      // Update room member count and members list if needed
      get().updateRoom(data.roomId, {
        memberCount: get().rooms.find(r => r._id === data.roomId)?.memberCount || 0 + 1,
      });
    },

    handleUserLeft: (data) => {
      // Update room member count
      get().updateRoom(data.roomId, {
        memberCount: Math.max(0, (get().rooms.find(r => r._id === data.roomId)?.memberCount || 1) - 1),
      });
    },

    reset: () => {
      set(initialState);
    },
  }))
);

// Subscribe to socket events
if (typeof window !== 'undefined') {
  const store = useChatStore.getState();
  
  // Message events
  socketManager.on('message:new', store.handleNewMessage);
  socketManager.on('message:edited', store.handleMessageEdited);
  socketManager.on('message:deleted', store.handleMessageDeleted);
  
  // Typing events
  socketManager.on('typing:start', (data) => {
    store.addTypingUser(data.roomId, data.username);
  });
  
  socketManager.on('typing:stop', (data) => {
    store.removeTypingUser(data.roomId, data.username);
  });
  
  // User status events
  socketManager.on('user:status', (data) => {
    store.updateUserStatus(data.userId, data.status, data.lastSeen);
  });
  
  // Room events
  socketManager.on('room:user_joined', store.handleUserJoined);
  socketManager.on('room:user_left', store.handleUserLeft);
  
  socketManager.on('room:created', (data) => {
    store.addRoom(data.room);
  });
  
  socketManager.on('room:direct_created', (data) => {
    store.addRoom(data.room);
  });
  
  // Message sent confirmation
  socketManager.on('message:sent', (data) => {
    if (data.tempId) {
      // Replace temporary message with real message
      store.updateMessage(data.tempId, {
        _id: data.message._id,
        createdAt: data.message.createdAt,
        updatedAt: data.message.updatedAt,
      });
    }
  });
  
  // Error handling
  socketManager.on('error', (data) => {
    toast.error(data.message);
  });
}

export default useChatStore;

