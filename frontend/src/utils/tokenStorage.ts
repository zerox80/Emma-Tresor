const ACCESS_TOKEN_KEY = 'emmatresor_access_token';
const REFRESH_TOKEN_KEY = 'emmatresor_refresh_token';
const SESSION_ACCESS_TOKEN_KEY = 'emmatresor_session_access_token';
const SESSION_REFRESH_TOKEN_KEY = 'emmatresor_session_refresh_token';

const isBrowser = typeof window !== 'undefined';

const getStorage = (storage: 'local' | 'session') => {
  if (!isBrowser) {
    return undefined;
  }
  return storage === 'local' ? window.localStorage : window.sessionStorage;
};

export const tokenStorage = {
  setTokens(access: string, refresh: string, remember: boolean) {
    const persistent = getStorage('local');
    const temporary = getStorage('session');

    if (persistent) {
      if (remember) {
        persistent.setItem(ACCESS_TOKEN_KEY, access);
        persistent.setItem(REFRESH_TOKEN_KEY, refresh);
      } else {
        persistent.removeItem(ACCESS_TOKEN_KEY);
        persistent.removeItem(REFRESH_TOKEN_KEY);
      }
    }

    if (temporary) {
      temporary.setItem(SESSION_ACCESS_TOKEN_KEY, access);
      temporary.setItem(SESSION_REFRESH_TOKEN_KEY, refresh);
    }
  },

  getTokens(): { access: string | null; refresh: string | null } {
    const persistent = getStorage('local');
    const temporary = getStorage('session');

    const sessionAccess = temporary?.getItem(SESSION_ACCESS_TOKEN_KEY);
    const sessionRefresh = temporary?.getItem(SESSION_REFRESH_TOKEN_KEY);

    const access = sessionAccess ?? persistent?.getItem(ACCESS_TOKEN_KEY) ?? null;
    const refresh = sessionRefresh ?? persistent?.getItem(REFRESH_TOKEN_KEY) ?? null;

    return { access, refresh };
  },

  updateAccessToken(access: string, refresh?: string) {
    const persistent = getStorage('local');
    const temporary = getStorage('session');

    if (temporary) {
      temporary.setItem(SESSION_ACCESS_TOKEN_KEY, access);
      if (refresh) {
        temporary.setItem(SESSION_REFRESH_TOKEN_KEY, refresh);
      }
    }
    if (persistent && persistent.getItem(ACCESS_TOKEN_KEY)) {
      persistent.setItem(ACCESS_TOKEN_KEY, access);
      if (refresh && persistent.getItem(REFRESH_TOKEN_KEY)) {
        persistent.setItem(REFRESH_TOKEN_KEY, refresh);
      }
    }
  },

  clearTokens() {
    const persistent = getStorage('local');
    const temporary = getStorage('session');

    persistent?.removeItem(ACCESS_TOKEN_KEY);
    persistent?.removeItem(REFRESH_TOKEN_KEY);
    temporary?.removeItem(SESSION_ACCESS_TOKEN_KEY);
    temporary?.removeItem(SESSION_REFRESH_TOKEN_KEY);
  },
};
