export const readToken = () => sessionStorage.getItem("sbToken") || localStorage.getItem("sbToken") || "";

export const readUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem("sbUser") || localStorage.getItem("sbUser") || "null");
  } catch {
    return null;
  }
};

export function clearSession() {
  [sessionStorage, localStorage].forEach((storage) => {
    storage.removeItem("sbToken");
    storage.removeItem("sbUser");
  });
}

export function saveSession(token, user, remember) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("sbToken", token);
  storage.setItem("sbUser", JSON.stringify(user));
}

export function saveUser(user) {
  const storage = sessionStorage.getItem("sbToken") ? sessionStorage : localStorage;
  storage.setItem("sbUser", JSON.stringify(user));
}

export function saveToken(token) {
  const storage = sessionStorage.getItem("sbToken") ? sessionStorage : localStorage;
  storage.setItem("sbToken", token);
}
