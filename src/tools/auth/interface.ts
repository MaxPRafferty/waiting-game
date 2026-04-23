export interface AuthUser {
  id: string;
  email?: string;
  is_anonymous: boolean;
}

export interface IAuth {
  /**
   * Validates a session token and returns the user if valid.
   */
  validateToken(token: string): Promise<AuthUser | null>;

  /**
   * Creates an anonymous session and returns the token and user.
   */
  signInAnonymous(): Promise<{ token: string; user: AuthUser }>;

  /**
   * Registers a new user with email and password.
   */
  signUp(email: string, password: string): Promise<{ token: string; user: AuthUser }>;

  /**
   * Signs in an existing user with email and password.
   */
  signIn(email: string, password: string): Promise<{ token: string; user: AuthUser }>;

  /**
   * Sends a One-Time Password (OTP) or Magic Link to email or phone.
   */
  sendOtp(target: { email?: string; phone?: string }): Promise<void>;

  /**
   * Verifies an OTP and returns the session token and user.
   */
  verifyOtp(target: { email?: string; phone?: string }, token: string, type: 'email' | 'sms' | 'magiclink'): Promise<{ token: string; user: AuthUser }>;
}
