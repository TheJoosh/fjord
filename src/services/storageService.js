function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson(key, fallback) {
  if (!canUseLocalStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeObjectMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export const storageService = {
  getString(key, fallback = '') {
    if (!key || !canUseLocalStorage()) return fallback;
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  },

  setString(key, value) {
    if (!key || !canUseLocalStorage()) return;
    localStorage.setItem(key, String(value ?? ''));
  },

  getJson(key, fallback) {
    if (!key) return fallback;
    return readJson(key, fallback);
  },

  setJson(key, value) {
    if (!key) return;
    writeJson(key, value);
  },

  remove(key) {
    if (!key || !canUseLocalStorage()) return;
    localStorage.removeItem(key);
  },

  getCurrentUserName() {
    if (!canUseLocalStorage()) return '';
    return (localStorage.getItem('userName') || '').trim();
  },

  setCurrentUserName(userName) {
    if (!canUseLocalStorage()) return;
    if (userName) {
      localStorage.setItem('userName', userName);
      return;
    }
    localStorage.removeItem('userName');
  },

  getUsersMap() {
    return normalizeObjectMap(readJson('users', {}));
  },

  setUsersMap(usersMap) {
    writeJson('users', normalizeObjectMap(usersMap));
  },

  getUsersPacksMap() {
    return normalizeObjectMap(readJson('usersPacks', {}));
  },

  setUsersPacksMap(packsMap) {
    writeJson('usersPacks', normalizeObjectMap(packsMap));
  },

  getUserPacks(userName, fallbackPacks = {}) {
    const packsMap = this.getUsersPacksMap();
    const source = packsMap?.[userName] || fallbackPacks || {};

    return {
      'Default Pack': parseInt(source['Default Pack'], 10) || 0,
      'Saga Pack': parseInt(source['Saga Pack'], 10) || 0,
      'Heroic Pack': parseInt(source['Heroic Pack'], 10) || 0,
      'Mythbound Pack': parseInt(source['Mythbound Pack'], 10) || 0,
    };
  },

  setUserPacks(userName, nextPacks) {
    if (!userName) return;
    const packsMap = this.getUsersPacksMap();
    packsMap[userName] = {
      ...(packsMap[userName] || {}),
      ...(nextPacks || {}),
    };
    this.setUsersPacksMap(packsMap);
  },

  getOwnedCards(userName) {
    if (!userName) return [];
    const entries = readJson(`ownedCards:${userName}`, []);
    return Array.isArray(entries) ? entries : [];
  },

  setOwnedCards(userName, entries) {
    if (!userName) return;
    writeJson(`ownedCards:${userName}`, Array.isArray(entries) ? entries : []);
  },

  getDesignedMap() {
    return normalizeObjectMap(readJson('usersDesigned', {}));
  },

  setDesignedMap(designedMap) {
    writeJson('usersDesigned', normalizeObjectMap(designedMap));
  },

  getDesignedCount(userName) {
    if (!userName || !canUseLocalStorage()) return 0;
    return parseInt(localStorage.getItem(`designed:${userName}`), 10) || 0;
  },

  setDesignedCount(userName, count) {
    if (!userName || !canUseLocalStorage()) return;
    localStorage.setItem(`designed:${userName}`, String(parseInt(count, 10) || 0));
  },
};
