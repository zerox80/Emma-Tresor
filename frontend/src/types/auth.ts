/**
 * Represents the payload for a login request.
 */
export interface LoginRequest {
  /** The user's email address. */
  email: string;
  /** The user's password. */
  password: string;
  /** Whether to remember the user's session. */
  rememberMe: boolean;
  /** The user's username (optional). */
  username?: string;
}

/**
 * Represents the response from a successful login request.
 */
export interface LoginResponse {
  /** The user's profile information. */
  user?: UserProfile;
  /** The expiration time of the access token in seconds. */
  access_expires: number;
  /** Whether the user's session is being remembered. */
  remember: boolean;
}

/**
 * Represents the payload for a registration request.
 */
export interface RegisterRequest {
  /** The user's chosen username. */
  username: string;
  /** The user's email address. */
  email: string;
  /** The user's password. */
  password: string;
  /** The user's password confirmation. */
  password_confirm: string;
}

/**
 * Represents a user's profile information.
 */
export interface UserProfile {
  /** The user's unique ID. */
  id: number;
  /** The user's username. */
  username: string;
  /** The user's email address. */
  email: string;
}
