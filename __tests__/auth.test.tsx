import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('@/lib/api');
jest.mock('@/lib/socket');
jest.mock('react-hot-toast');

const mockAuthAPI = authAPI as jest.Mocked<typeof authAPI>;
const mockToast = toast as jest.Mocked<typeof toast>;

// Test component that uses auth context
const TestComponent = () => {
  const { user, login, register, logout, loading, isAuthenticated } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <button onClick={() => login({ email: 'test@example.com', password: 'password' })}>
        Login
      </button>
      <button onClick={() => register({ username: 'testuser', email: 'test@example.com', password: 'password' })}>
        Register
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

const renderWithAuth = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  it('should initialize with loading state', () => {
    renderWithAuth(<TestComponent />);
    
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('should handle successful login', async () => {
    const mockUser = {
      _id: '1',
      username: 'testuser',
      email: 'test@example.com',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockAuthAPI.login.mockResolvedValue({
      success: true,
      data: {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '7d',
      },
    });

    renderWithAuth(<TestComponent />);

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockAuthAPI.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    expect(mockToast.success).toHaveBeenCalledWith('Welcome back!');
  });

  it('should handle failed login', async () => {
    mockAuthAPI.login.mockResolvedValue({
      success: false,
      message: 'Invalid credentials',
    });

    renderWithAuth(<TestComponent />);

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockAuthAPI.login).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    expect(mockToast.error).toHaveBeenCalledWith('Invalid credentials');
  });

  it('should handle successful registration', async () => {
    const mockUser = {
      _id: '1',
      username: 'testuser',
      email: 'test@example.com',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockAuthAPI.register.mockResolvedValue({
      success: true,
      data: {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '7d',
      },
    });

    renderWithAuth(<TestComponent />);

    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(mockAuthAPI.register).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    expect(mockToast.success).toHaveBeenCalledWith('Account created successfully!');
  });

  it('should handle registration with validation errors', async () => {
    mockAuthAPI.register.mockResolvedValue({
      success: false,
      message: 'Validation failed',
      errors: [
        { field: 'email', message: 'Email already exists' },
        { field: 'username', message: 'Username already taken' },
      ],
    });

    renderWithAuth(<TestComponent />);

    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(mockAuthAPI.register).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
    });

    expect(mockToast.error).toHaveBeenCalledWith('Email already exists');
    expect(mockToast.error).toHaveBeenCalledWith('Username already taken');
  });

  it('should handle logout', async () => {
    // First set up authenticated state
    const mockUser = {
      _id: '1',
      username: 'testuser',
      email: 'test@example.com',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockAuthAPI.login.mockResolvedValue({
      success: true,
      data: {
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '7d',
      },
    });

    mockAuthAPI.logout.mockResolvedValue({
      success: true,
      message: 'Logout successful',
    });

    renderWithAuth(<TestComponent />);

    // Login first
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
    });

    // Then logout
    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(mockAuthAPI.logout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    expect(mockToast.success).toHaveBeenCalledWith('Logged out successfully');
  });

  it('should initialize with existing token', async () => {
    const mockUser = {
      _id: '1',
      username: 'testuser',
      email: 'test@example.com',
      status: 'online',
      lastSeen: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mock localStorage to return a token
    (window.localStorage.getItem as jest.Mock).mockReturnValue('existing-token');

    mockAuthAPI.getProfile.mockResolvedValue({
      success: true,
      data: { user: mockUser },
    });

    renderWithAuth(<TestComponent />);

    await waitFor(() => {
      expect(mockAuthAPI.getProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });
  });

  it('should clear tokens on invalid profile response', async () => {
    // Mock localStorage to return a token
    (window.localStorage.getItem as jest.Mock).mockReturnValue('invalid-token');

    mockAuthAPI.getProfile.mockResolvedValue({
      success: false,
      message: 'Invalid token',
    });

    renderWithAuth(<TestComponent />);

    await waitFor(() => {
      expect(mockAuthAPI.getProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('accessToken');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
  });
});

