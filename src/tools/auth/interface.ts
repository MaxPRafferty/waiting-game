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
}
