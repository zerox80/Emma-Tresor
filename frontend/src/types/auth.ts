/**
 * Represents the data structure for a user login request.
 */
export interface LoginRequest {
  /** The user's email address used for authentication. */
  email: string;
  /** The user's password. */
  password: string;
  /** A boolean indicating whether the user's session should be remembered across browser sessions. */
  rememberMe: boolean;
  /** Optional: The user's username, if login is also supported via username. */
  username?: string;
}

/**
 * Represents the data structure for a successful login response from the API.
 */
export interface LoginResponse {
  /** The user's profile information, typically returned upon successful authentication. */
  user?: UserProfile;
  /** The expiration time of the access token in seconds from the time of issue. */
  access_expires: number;
  /** A boolean indicating whether the user's session is being remembered. */
  remember: boolean;
}

/**
 * Represents the data structure for a new user registration request.
 */
export interface RegisterRequest {
  /** The user's chosen unique username. */
  username: string;
  /** The user's email address, which must be unique. */
  email: string;
  /** The user's chosen password. */
  password: string;
  /** Confirmation of the user's password, must match `password`. */
  password_confirm: string;
}

/**
 * Represents the data structure for a user's profile information.
 */
export interface UserProfile {
  /** The unique identifier for the user. */
  id: number;
  /** The user's unique username. */
  username: string;
  /** The user's unique email address. */
  email: string;
}
