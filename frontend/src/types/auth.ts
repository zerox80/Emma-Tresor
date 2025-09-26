export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
  username?: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user?: UserProfile;
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
