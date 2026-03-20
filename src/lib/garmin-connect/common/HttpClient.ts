import { fetch } from '@tauri-apps/plugin-http';
import { DateTime } from 'luxon';
import OAuth from 'oauth-1.0a';
import qs from 'qs';
import type { IOauth1, IOauth1Consumer, IOauth1Token, IOauth2Token } from '../garmin/types';
import type { UrlClass } from '../garmin/UrlClass';
import type { ICryptoProvider } from './ICryptoProvider';

const USER_AGENT_CONNECTMOBILE = 'com.garmin.android.apps.connectmobile';

const OAUTH_CONSUMER_URL = 'https://thegarth.s3.amazonaws.com/oauth_consumer.json';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export class HttpClient {
  url: UrlClass;
  oauth1Token: IOauth1Token | undefined;
  oauth2Token: IOauth2Token | undefined;
  OAUTH_CONSUMER: IOauth1Consumer | undefined;
  cryptoProvider: ICryptoProvider;
  private authPromiseResolve: ((ticket: string) => void) | null = null;
  private authPromiseReject: ((error: Error) => void) | null = null;

  constructor(url: UrlClass, cryptoProvider: ICryptoProvider) {
    this.url = url;
    this.cryptoProvider = cryptoProvider;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.oauth2Token) {
      headers['Authorization'] = `Bearer ${this.oauth2Token.access_token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401 && this.oauth2Token && !isRefreshing) {
      isRefreshing = true;
      await this.refreshOauth2Token();
      isRefreshing = false;
      refreshSubscribers.forEach((sub) => sub(this.oauth2Token!.access_token));
      refreshSubscribers = [];
      // Retry not possible with fetch directly — caller should retry
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  async get<T>(
    url: string,
    config?: {
      headers?: Record<string, string>;
      params?: Record<string, unknown>;
      responseType?: string;
    },
  ): Promise<T> {
    let fullUrl = url;
    if (config?.params) {
      const filtered = Object.fromEntries(
        Object.entries(config.params).filter(([, v]) => v !== undefined && v !== null),
      );
      if (Object.keys(filtered).length > 0) {
        fullUrl += `?${qs.stringify(filtered)}`;
      }
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { ...this.getHeaders(), ...config?.headers },
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(
    url: string,
    data: unknown,
    config?: { headers?: Record<string, string> },
  ): Promise<T> {
    const headers: Record<string, string> = { ...this.getHeaders(), ...config?.headers };
    let body: string | undefined;

    if (data !== null && data !== undefined) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(
    url: string,
    data: unknown,
    config?: { headers?: Record<string, string> },
  ): Promise<T> {
    const headers: Record<string, string> = { ...this.getHeaders(), ...config?.headers };
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: typeof data === 'string' ? data : JSON.stringify(data),
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(url: string, config?: { headers?: Record<string, string> }): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        ...config?.headers,
        'X-Http-Method-Override': 'DELETE',
      },
    });
    return this.handleResponse<T>(response);
  }

  async fetchOauthConsumer() {
    console.debug('GarminConnect: Fetching OAuth consumer from S3...');
    const response = await fetch(OAUTH_CONSUMER_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Garmin OAuth credentials: ${response.statusText}`);
    }
    const data = (await response.json()) as { consumer_key: string; consumer_secret: string };
    this.OAUTH_CONSUMER = {
      key: data.consumer_key,
      secret: data.consumer_secret,
    };
  }

  async login(): Promise<{ authUrl: string; ticketPromise: Promise<string> }> {
    console.debug('GarminConnect: Starting login flow');
    await this.fetchOauthConsumer();

    // Step 1: Set cookie
    const step1Params = {
      clientId: 'GarminConnect',
      locale: 'en',
      service: this.url.GC_MODERN,
    };
    const step1Url = `${this.url.GARMIN_SSO_EMBED}?${qs.stringify(step1Params)}`;
    await fetch(step1Url);

    // Step 2-3: Generate auth URL for WebView
    const signinParams = {
      id: 'gauth-widget',
      embedWidget: true,
      clientId: 'GarminConnect',
      locale: 'en',
      gauthHost: this.url.GARMIN_SSO_EMBED,
      service: this.url.GARMIN_SSO_EMBED,
      source: this.url.GARMIN_SSO_EMBED,
      redirectAfterAccountLoginUrl: this.url.GARMIN_SSO_EMBED,
      redirectAfterAccountCreationUrl: this.url.GARMIN_SSO_EMBED,
    };
    const authUrl = `${this.url.SIGNIN_URL}?${qs.stringify(signinParams)}`;

    const ticketPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Garmin authentication timeout - no response within 3 minutes')),
        3 * 60 * 1000,
      );

      this.authPromiseResolve = (ticket: string) => {
        clearTimeout(timeout);
        resolve(ticket);
      };
      this.authPromiseReject = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });

    return { authUrl, ticketPromise };
  }

  async completeLogin(ticket: string): Promise<HttpClient> {
    console.debug(`GarminConnect: Completing login with ticket`);
    const oauth1 = await this.getOauth1Token(ticket);
    await this.exchange(oauth1);
    return this;
  }

  handleAuthCallback(url: string): void {
    console.debug(`GarminConnect: Received auth callback URL: ${url}`);
    try {
      const parsed = qs.parse(url.split('?')[1]);
      const ticket = parsed.ticket as string;

      if (!ticket) {
        this.authPromiseReject?.(new Error('No ticket found in callback URL'));
        return;
      }

      this.authPromiseResolve?.(ticket);
    } catch (error) {
      this.authPromiseReject?.(new Error(`Failed to parse callback URL: ${error}`));
    }
  }

  async refreshOauth2Token() {
    if (!this.OAUTH_CONSUMER) {
      await this.fetchOauthConsumer();
    }
    if (!this.oauth2Token || !this.oauth1Token) {
      throw new Error('No Oauth2Token or Oauth1Token');
    }
    const oauth1 = {
      oauth: this.getOauthClient(this.OAUTH_CONSUMER!),
      token: this.oauth1Token,
    };
    await this.exchange(oauth1);
    console.log('Oauth2 token refreshed!');
  }

  async getOauth1Token(ticket: string): Promise<IOauth1> {
    if (!this.OAUTH_CONSUMER) {
      throw new Error('No OAUTH_CONSUMER');
    }

    const params = {
      ticket,
      'login-url': this.url.GARMIN_SSO_EMBED,
      'accepts-mfa-tokens': true,
    };
    const url = `${this.url.OAUTH_URL}/preauthorized?${qs.stringify(params)}`;

    const oauth = this.getOauthClient(this.OAUTH_CONSUMER);
    const step4RequestData = { url, method: 'GET' };
    const headers = oauth.toHeader(oauth.authorize(step4RequestData));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': USER_AGENT_CONNECTMOBILE,
      },
    });

    const responseText = await response.text();
    const token = qs.parse(responseText) as unknown as IOauth1Token;
    this.oauth1Token = token;
    return { token, oauth };
  }

  getOauthClient(consumer: IOauth1Consumer): OAuth {
    return new OAuth({
      consumer,
      signature_method: 'HMAC-SHA1',
      hash_function: (base_string: string, key: string) => {
        return this.cryptoProvider.hmacSha1(base_string, key);
      },
    });
  }

  async exchange(oauth1: IOauth1) {
    const token = {
      key: oauth1.token.oauth_token,
      secret: oauth1.token.oauth_token_secret,
    };

    const baseUrl = `${this.url.OAUTH_URL}/exchange/user/2.0`;
    const requestData = { url: baseUrl, method: 'POST', data: null };
    const step5AuthData = oauth1.oauth.authorize(requestData, token);
    const url = `${baseUrl}?${qs.stringify(step5AuthData)}`;

    this.oauth2Token = undefined;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT_CONNECTMOBILE,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`OAuth2 exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as IOauth2Token;
    this.oauth2Token = this.setOauth2TokenExpiresAt(data);
  }

  setOauth2TokenExpiresAt(token: IOauth2Token): IOauth2Token {
    token['last_update_date'] = DateTime.now().toLocal().toString();
    token['expires_date'] = DateTime.fromSeconds(DateTime.now().toSeconds() + token['expires_in'])
      .toLocal()
      .toString();
    token['expires_at'] = DateTime.now().toSeconds() + token['expires_in'];
    token['refresh_token_expires_at'] =
      DateTime.now().toSeconds() + token['refresh_token_expires_in'];
    return token;
  }
}
