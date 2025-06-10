import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, AuthTokens, User, Room, Message, PaginatedResponse } from '@/types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Initialize tokens from localStorage (client-side only)
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (refreshToken) {
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh-token`,
            { refreshToken }
          );

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
          
          setTokens(newAccessToken, newRefreshToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Token management functions
export const setTokens = (newAccessToken: string, newRefreshToken: string) => {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
  }
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

export const getAccessToken = () => accessToken;

// API wrapper function
const apiRequest = async <T = any>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await api(config);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }
    
    return {
      success: false,
      message: error.message || 'An unexpected error occurred',
    };
  }
};

// Authentication API
export const authAPI = {
  register: async (credentials: {
    username: string;
    email: string;
    password: string;
  }): Promise<ApiResponse<{ user: User } & AuthTokens>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/auth/register',
      data: credentials,
    });
  },

  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse<{ user: User } & AuthTokens>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/auth/login',
      data: credentials,
    });
  },

  logout: async (): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: '/api/auth/logout',
    });
  },

  getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/auth/profile',
    });
  },

  updateProfile: async (data: {
    username?: string;
    bio?: string;
    avatar?: string;
  }): Promise<ApiResponse<{ user: User }>> => {
    return apiRequest({
      method: 'PUT',
      url: '/api/auth/profile',
      data,
    });
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse> => {
    return apiRequest({
      method: 'PUT',
      url: '/api/auth/change-password',
      data,
    });
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<AuthTokens>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/auth/refresh-token',
      data: { refreshToken },
    });
  },
};

// Rooms API
export const roomsAPI = {
  getUserRooms: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<{ rooms: Room[] }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/rooms',
      params,
    });
  },

  getRoomById: async (roomId: string): Promise<ApiResponse<{ room: Room }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/rooms/${roomId}`,
    });
  },

  createRoom: async (data: {
    name: string;
    description?: string;
    type?: 'group' | 'public';
    isPrivate?: boolean;
    maxMembers?: number;
  }): Promise<ApiResponse<{ room: Room }>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/rooms',
      data,
    });
  },

  createDirectRoom: async (data: {
    userIdToChat: string;
  }): Promise<ApiResponse<{ room: Room }>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/rooms/direct',
      data,
    });
  },

  updateRoom: async (
    roomId: string,
    data: {
      name?: string;
      description?: string;
      avatar?: string;
      settings?: {
        isPrivate?: boolean;
        allowInvites?: boolean;
        maxMembers?: number;
      };
    }
  ): Promise<ApiResponse<{ room: Room }>> => {
    return apiRequest({
      method: 'PUT',
      url: `/api/rooms/${roomId}`,
      data,
    });
  },

  deleteRoom: async (roomId: string): Promise<ApiResponse> => {
    return apiRequest({
      method: 'DELETE',
      url: `/api/rooms/${roomId}`,
    });
  },

  joinRoom: async (roomId: string): Promise<ApiResponse<{ room: Room }>> => {
    return apiRequest({
      method: 'POST',
      url: `/api/rooms/${roomId}/join`,
    });
  },

  leaveRoom: async (roomId: string): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: `/api/rooms/${roomId}/leave`,
    });
  },

  addMember: async (
    roomId: string,
    data: {
      userIdToAdd: string;
      role?: 'admin' | 'moderator' | 'member';
    }
  ): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: `/api/rooms/${roomId}/members`,
      data,
    });
  },

  removeMember: async (
    roomId: string,
    data: {
      userIdToRemove: string;
    }
  ): Promise<ApiResponse> => {
    return apiRequest({
      method: 'DELETE',
      url: `/api/rooms/${roomId}/members`,
      data,
    });
  },

  updateMemberRole: async (
    roomId: string,
    data: {
      userIdToUpdate: string;
      newRole: 'admin' | 'moderator' | 'member';
    }
  ): Promise<ApiResponse> => {
    return apiRequest({
      method: 'PUT',
      url: `/api/rooms/${roomId}/members/role`,
      data,
    });
  },

  getPublicRooms: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<{ rooms: Room[] }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/rooms/public',
      params,
    });
  },
};

// Messages API
export const messagesAPI = {
  getRoomMessages: async (
    roomId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<{ messages: Message[] }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/messages/room/${roomId}`,
      params,
    });
  },

  searchMessages: async (
    roomId: string,
    params: {
      q: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<{ messages: Message[]; query: string }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/messages/room/${roomId}/search`,
      params,
    });
  },

  getMessageById: async (messageId: string): Promise<ApiResponse<{ message: Message }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/messages/${messageId}`,
    });
  },

  updateMessage: async (
    messageId: string,
    data: {
      content: string;
    }
  ): Promise<ApiResponse<{ message: Message }>> => {
    return apiRequest({
      method: 'PUT',
      url: `/api/messages/${messageId}`,
      data,
    });
  },

  deleteMessage: async (messageId: string): Promise<ApiResponse> => {
    return apiRequest({
      method: 'DELETE',
      url: `/api/messages/${messageId}`,
    });
  },

  addReaction: async (
    messageId: string,
    data: {
      emoji: string;
    }
  ): Promise<ApiResponse<{ reactions: any[] }>> => {
    return apiRequest({
      method: 'POST',
      url: `/api/messages/${messageId}/reactions`,
      data,
    });
  },

  removeReaction: async (
    messageId: string,
    data: {
      emoji: string;
    }
  ): Promise<ApiResponse<{ reactions: any[] }>> => {
    return apiRequest({
      method: 'DELETE',
      url: `/api/messages/${messageId}/reactions`,
      data,
    });
  },

  markAsRead: async (
    roomId: string,
    data?: {
      messageIds?: string[];
    }
  ): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: `/api/messages/room/${roomId}/mark-read`,
      data,
    });
  },

  getUnreadCount: async (roomId: string): Promise<ApiResponse<{
    roomId: string;
    unreadCount: number;
    lastReadAt: string;
  }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/messages/room/${roomId}/unread-count`,
    });
  },
};

// Users API
export const usersAPI = {
  searchUsers: async (params: {
    q: string;
    limit?: number;
  }): Promise<ApiResponse<{ users: User[]; query: string; total: number }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/users/search',
      params,
    });
  },

  getUserById: async (userId: string): Promise<ApiResponse<{ user: User }>> => {
    return apiRequest({
      method: 'GET',
      url: `/api/users/${userId}`,
    });
  },

  getOnlineUsers: async (params?: {
    limit?: number;
  }): Promise<ApiResponse<{ users: User[]; total: number }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/users/online',
      params,
    });
  },

  getFriends: async (): Promise<ApiResponse<{ friends: User[]; total: number }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/users/friends',
    });
  },

  addFriend: async (data: {
    userIdToAdd: string;
  }): Promise<ApiResponse<{ friend: User }>> => {
    return apiRequest({
      method: 'POST',
      url: '/api/users/friends',
      data,
    });
  },

  removeFriend: async (data: {
    userIdToRemove: string;
  }): Promise<ApiResponse> => {
    return apiRequest({
      method: 'DELETE',
      url: '/api/users/friends',
      data,
    });
  },

  blockUser: async (data: {
    userIdToBlock: string;
  }): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: '/api/users/block',
      data,
    });
  },

  unblockUser: async (data: {
    userIdToUnblock: string;
  }): Promise<ApiResponse> => {
    return apiRequest({
      method: 'POST',
      url: '/api/users/unblock',
      data,
    });
  },

  getBlockedUsers: async (): Promise<ApiResponse<{ blockedUsers: User[]; total: number }>> => {
    return apiRequest({
      method: 'GET',
      url: '/api/users/blocked',
    });
  },

  updateStatus: async (data: {
    status: 'online' | 'away' | 'busy' | 'offline';
  }): Promise<ApiResponse<{ status: string; lastSeen: string }>> => {
    return apiRequest({
      method: 'PUT',
      url: '/api/users/status',
      data,
    });
  },
};

export default api;

