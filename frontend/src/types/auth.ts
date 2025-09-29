export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
  username?: string;
}

export interface LoginResponse {
  user?: UserProfile;
  access_expires: number;
  remember: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
}
