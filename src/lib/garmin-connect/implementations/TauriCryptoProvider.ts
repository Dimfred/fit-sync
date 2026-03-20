import Base64 from 'crypto-js/enc-base64';
import hmacSHA1 from 'crypto-js/hmac-sha1';
import type { ICryptoProvider } from '../common/ICryptoProvider';

export class TauriCryptoProvider implements ICryptoProvider {
  hmacSha1(baseString: string, key: string): string {
    return Base64.stringify(hmacSHA1(baseString, key));
  }
}
