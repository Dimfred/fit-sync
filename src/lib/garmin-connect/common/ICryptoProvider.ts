/**
 * Abstract interface for cryptographic operations
 * Allows different implementations for Node.js and React Native
 */
export interface ICryptoProvider {
  /**
   * Create HMAC-SHA1 signature
   * @param baseString - The string to sign
   * @param key - The secret key
   * @returns Base64-encoded signature
   */
  hmacSha1(baseString: string, key: string): string;
}
