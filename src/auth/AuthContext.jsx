import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMe, logoutApi } from '../api.js';
import LoginSheet from '../components/LoginSheet.jsx';
import { clearAuth, loadAuth, onUnauthorized, saveAuth } from './token.js';

// Browse karne ke liye login nahi chahiye. Login tabhi maanga jata hai jab openLogin() bulao
// (jaise cart se Proceed dabane par).
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadAuth);
  const [loginOpen, setLoginOpen] = useState(false);
  const afterLogin = useRef(null);

  // Server 401 de to local login hata do
  useEffect(() => {
    onUnauthorized(() => {
      clearAuth();
      setAuth(null);
    });
    return () => onUnauthorized(null);
  }, []);

  // App khulte hi token check (expire ho gaya ho to upar wala handler logout kar dega)
  useEffect(() => {
    if (!loadAuth()) return;
    getMe()
      .then((res) =>
        setAuth((a) => {
          if (!a) return a;
          const next = { ...a, customer: res.customer };
          saveAuth(next);
          return next;
        })
      )
      .catch(() => {});
  }, []);

  // Doosre tab mein login/logout ho to yahan bhi dikhe
  useEffect(() => {
    const onStorage = (e) => e.key === 'vakaro_auth_v1' && setAuth(loadAuth());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // onDone: login hone ke baad jo kaam karna hai (optional)
  const openLogin = useCallback((onDone) => {
    afterLogin.current = typeof onDone === 'function' ? onDone : null;
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    afterLogin.current = null;
    setLoginOpen(false);
  }, []);

  const completeLogin = useCallback((token, customer) => {
    const next = { token, customer };
    saveAuth(next);
    setAuth(next);
    setLoginOpen(false);
    const cb = afterLogin.current;
    afterLogin.current = null;
    if (cb) cb();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (e) {
      /* server na mile tab bhi device se logout ho jaye */
    }
    clearAuth();
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({ customer: auth?.customer || null, isLoggedIn: !!auth, openLogin, logout }),
    [auth, openLogin, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginSheet open={loginOpen} onClose={closeLogin} onSuccess={completeLogin} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
} 