import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '@/types';
import { getAccessToken } from './api';

class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeSocket();
    }
  }

  private initializeSocket() {
    const token = getAccessToken();
    
    if (!token) {
      console.warn('No access token available for socket connection');
      return;
    }

    if (this.socket?.connected) {
      return this.socket;
    }

    this.isConnecting = true;

    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', error);
      this.isConnecting = false;
      
      if (error.message.includes('Authentication')) {
        console.error('Authentication failed, redirecting to login...');
        this.disconnect();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Socket reconnection attempt ${attemptNumber}`);
      this.reconnectAttempts = attemptNumber;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔴 Socket reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔴 Socket reconnection failed after maximum attempts');
      this.disconnect();
    });

    // Handle ping/pong for connection health
    this.socket.on('pong', () => {
      // Connection is healthy
    });

    // Send ping every 30 seconds to keep connection alive
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  public connect(): Socket | null {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.socket;
    }

    return this.initializeSocket();
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public emit<K extends keyof SocketEvents>(
    event: K,
    data: SocketEvents[K]
  ): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${String(event)}: Socket not connected`);
    }
  }

  public on<K extends keyof SocketEvents>(
    event: K,
    callback: (data: SocketEvents[K]) => void
  ): void {
    if (this.socket) {
      this.socket.on(event as string, callback);
    }
  }

  public off<K extends keyof SocketEvents>(
    event: K,
    callback?: (data: SocketEvents[K]) => void
  ): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event as string, callback);
      } else {
        this.socket.off(event as string);
      }
    }
  }

  public once<K extends keyof SocketEvents>(
    event: K,
    callback: (data: SocketEvents[K]) => void
  ): void {
    if (this.socket) {
      this.socket.once(event as string, callback);
    }
  }

  // Utility methods for common socket operations
  public joinRoom(roomId: string): void {
    this.emit('room:join', { roomId });
  }

  public leaveRoom(roomId: string): void {
    this.emit('room:leave', { roomId });
  }

  public sendMessage(data: {
    roomId: string;
    content: string;
    type?: 'text' | 'image' | 'file';
    metadata?: any;
    tempId?: string;
  }): void {
    this.emit('message:send', data);
  }

  public startTyping(roomId: string): void {
    this.emit('typing:start', { roomId });
  }

  public stopTyping(roomId: string): void {
    this.emit('typing:stop', { roomId });
  }

  public updateStatus(status: 'online' | 'away' | 'busy'): void {
    this.emit('status:update', { status });
  }

  public markMessagesAsRead(roomId: string, messageIds?: string[]): void {
    this.emit('messages:mark_read', { roomId, messageIds });
  }

  public searchUsers(query: string): void {
    this.emit('users:search', { query });
  }

  public createRoom(data: {
    name: string;
    description?: string;
    type?: 'group' | 'public';
    isPrivate?: boolean;
    maxMembers?: number;
  }): void {
    this.emit('room:create', data);
  }

  public createDirectRoom(userIdToChat: string): void {
    this.emit('room:create_direct', { userIdToChat });
  }

  public inviteToRoom(roomId: string, userIdToInvite: string): void {
    this.emit('room:invite', { roomId, userIdToInvite });
  }

  public addReaction(messageId: string, emoji: string): void {
    this.emit('message:react', { messageId, emoji });
  }

  public removeReaction(messageId: string, emoji: string): void {
    this.emit('message:unreact', { messageId, emoji });
  }

  public editMessage(messageId: string, content: string): void {
    this.emit('message:edit', { messageId, content });
  }

  public deleteMessage(messageId: string): void {
    this.emit('message:delete', { messageId });
  }

  // Connection status helpers
  public waitForConnection(timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      this.once('connection:established', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  public getConnectionStatus(): {
    connected: boolean;
    connecting: boolean;
    reconnectAttempts: number;
    socketId?: string;
  } {
    return {
      connected: this.isConnected(),
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id,
    };
  }
}

// Create singleton instance
const socketManager = new SocketManager();

export default socketManager;

// Export individual methods for convenience
export const {
  connect,
  disconnect,
  getSocket,
  isConnected,
  emit,
  on,
  off,
  once,
  joinRoom,
  leaveRoom,
  sendMessage,
  startTyping,
  stopTyping,
  updateStatus,
  markMessagesAsRead,
  searchUsers,
  createRoom,
  createDirectRoom,
  inviteToRoom,
  addReaction,
  removeReaction,
  editMessage,
  deleteMessage,
  waitForConnection,
  getConnectionStatus,
} = socketManager;

