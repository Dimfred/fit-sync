import type { IOauth1Token, IOauth2Token } from '../garmin/types';

/**
 * Abstract interface for token storage
 * Allows different implementations for Node.js (file-based), React Native (AsyncStorage), etc.
 */
export interface ITokenStorage {
  /**
   * Retrieve stored OAuth tokens
   * @returns Object with oauth1 and oauth2 tokens, or null if not found
   */
  getTokens(): Promise<{ oauth1?: IOauth1Token; oauth2?: IOauth2Token } | null>;

  /**
   * Store OAuth tokens
   * @param oauth1 - OAuth1 token
   * @param oauth2 - OAuth2 token
   */
  setTokens(oauth1: IOauth1Token, oauth2: IOauth2Token): Promise<void>;

  /**
   * Clear stored tokens
   */
  clearTokens(): Promise<void>;
}
