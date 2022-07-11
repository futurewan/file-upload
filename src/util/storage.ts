export const getItem = (name: string): any => {
  const localData = localStorage.getItem(name);
  try {
    return localData !== null ? JSON.parse(localData) : null;
  } catch (e) {
    return localData;
  }
};

export const setItem = (name: string, value: unknown): void => {
  if (!name) return;
  localStorage.setItem(name, JSON.stringify(value));
};

export const removeItem = (name: string): void => {
  if (!name) return;
  localStorage.removeItem(name);
};

export const setSessionItem = (name: string, value: unknown): any => {
  if (!name) return;
  sessionStorage.setItem(name, JSON.stringify(value));
};

export const getSessionItem = (name: string): any => {
  const sessionData = sessionStorage.getItem(name);
  try {
    return sessionData !== null ? JSON.parse(sessionData) : null;
  } catch (e) {
    return sessionData;
  }
};
