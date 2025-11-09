// Authentication Type Definitions
// ==============================
// This module contains TypeScript interfaces for authentication-related
// data structures used throughout the application.

/**
 * Interface for user login request payload.
 *
 * Used when authenticating users with email/username and password.
 * Supports both email-based and username-based authentication.
 */
export interface LoginRequest {
  /** User's email address (required for email-based login) */
  email: string;
  
  /** User's password (required) */
  password: string;
  
  /** Whether to remember the user's session across browser restarts */
  rememberMe: boolean;
  
  /** User's username (optional, alternative to email-based login) */
  username?: string;
}

/**
 * Interface for login response from the backend.
 *
 * Contains user profile data and session information
 * returned after successful authentication.
 */
export interface LoginResponse {
  /** User profile data if authentication was successful */
  user?: UserProfile;
  
  /** Access token expiration time in seconds from now */
  access_expires: number;
  
  /** Whether the user chose to be remembered on the backend */
  remember: boolean;
}

/**
 * Interface for user registration request payload.
 *
 * Used when creating new user accounts in the system.
 * Includes all required fields for account creation.
 */
export interface RegisterRequest {
  /** Unique username for the new account (required) */
  username: string;
  
  /** Email address for the new account (required) */
  email: string;
  
  /** Password for the new account (required) */
  password: string;
  
  /** Password confirmation to prevent typos (required) */
  password_confirm: string;
}

/**
 * Interface for user profile data.
 *
 * Represents the basic user information that
 * is stored and returned by the authentication system.
 */
export interface UserProfile {
  /** Unique database identifier for the user */
  id: number;
  
  /** User's unique username for login */
  username: string;
  
  /** User's email address for notifications and login */
  email: string;
}
