import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearSession, readToken, readUser, saveSession, saveUser, saveToken } from "../services/session.js";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

function clearVideoAccessCookie() {
  fetch("/api/lessons/video-access", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(readUser);
  const [sessionReady, setSessionReady] = useState(() => !readToken());

  useEffect(() => {
    let active = true;
    const clearInvalidSession = () => {
      clearVideoAccessCookie();
      clearSession();
      setToken("");
      setUser(null);
    };
    window.addEventListener("skillbridge:session-expired", clearInvalidSession);

    if (!readToken()) {
      setSessionReady(true);
      return () => {
        active = false;
        window.removeEventListener("skillbridge:session-expired", clearInvalidSession);
      };
    }

    api("/auth/me", { method: "GET", auth: true })
      .then((data) => {
        if (!active) return;
        saveUser(data.user);
        setUser(data.user);
      })
      .catch((error) => {
        if (!active) return;
        if ([401, 403, 404].includes(error.status)) clearInvalidSession();
      })
      .finally(() => {
        if (active) setSessionReady(true);
      });

    return () => {
      active = false;
      window.removeEventListener("skillbridge:session-expired", clearInvalidSession);
    };
  }, []);

  const signIn = (nextToken, nextUser, remember) => {
    saveSession(nextToken, nextUser, remember);
    setToken(nextToken);
    setUser(nextUser);
  };

  const updateToken = (nextToken) => {
    saveToken(nextToken);
    setToken(nextToken);
  };

  const updateUser = (nextUser) => {
    saveUser(nextUser);
    setUser(nextUser);
  };

  const signOut = () => {
    clearVideoAccessCookie();
    clearSession();
    setToken("");
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, sessionReady, signIn, signOut, updateUser, updateToken }), [token, user, sessionReady]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}


