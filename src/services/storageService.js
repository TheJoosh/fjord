const config = require('../DBConfig.json');

const url = `mongodb+srv://${config.userName}:${config.password}@${config.hostname}/?appName=Fjord`;

const client = new MongoClient(url);
const db = client.db('Fjord');
const cards = db.collection('cards');
const users = db.collection('users');

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
  async getString(key, fallback = '') {
    if (!key || !canUseLocalStorage()) return fallback;
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  },

  async setString(key, value) {
    if (!key || !canUseLocalStorage()) return;
    localStorage.setItem(key, String(value ?? ''));
  },

  async getJson(key, fallback) {
    if (!key) return fallback;
    return readJson(key, fallback);
  },

  async setJson(key, value) {
    if (!key) return;
    writeJson(key, value);
  },

  async remove(key) {
    if (!key || !canUseLocalStorage()) return;
    localStorage.removeItem(key);
  },

  async getCurrentUserName() {
    if (!canUseLocalStorage()) return '';
    return (localStorage.getItem('userName') || '').trim();
  },

  async setCurrentUserName(userName) {
    if (!canUseLocalStorage()) return;
    if (userName) {
      localStorage.setItem('userName', userName);
      return;
    }
    localStorage.removeItem('userName');
  },

  async getUsersMap() {
    return normalizeObjectMap(readJson('users', {}));
  },

  async setUsersMap(usersMap) {
    writeJson('users', normalizeObjectMap(usersMap));
  },

  async getUsersPacksMap() {
    return normalizeObjectMap(readJson('usersPacks', {}));
  },

  async setUsersPacksMap(packsMap) {
    writeJson('usersPacks', normalizeObjectMap(packsMap));
  },

  async getUserPacks(userName, fallbackPacks = {}) {
    const packsMap = await this.getUsersPacksMap();
    const source = packsMap?.[userName] || fallbackPacks || {};

    return {
      'Default Pack': parseInt(source['Default Pack'], 10) || 0,
      'Saga Pack': parseInt(source['Saga Pack'], 10) || 0,
      'Heroic Pack': parseInt(source['Heroic Pack'], 10) || 0,
      'Mythbound Pack': parseInt(source['Mythbound Pack'], 10) || 0,
    };
  },

  async setUserPacks(userName, nextPacks) {
    if (!userName) return;
    const packsMap = await this.getUsersPacksMap();
    packsMap[userName] = {
      ...(packsMap[userName] || {}),
      ...(nextPacks || {}),
    };
    await this.setUsersPacksMap(packsMap);
  },

  async getOwnedCards(userName) {
    if (!userName) return [];
    const entries = readJson(`ownedCards:${userName}`, []);
    return Array.isArray(entries) ? entries : [];
  },

  async setOwnedCards(userName, entries) {
    if (!userName) return;
    writeJson(`ownedCards:${userName}`, Array.isArray(entries) ? entries : []);
  },

  async getDesignedMap() {
    return normalizeObjectMap(readJson('usersDesigned', {}));
  },

  async setDesignedMap(designedMap) {
    writeJson('usersDesigned', normalizeObjectMap(designedMap));
  },

  async getDesignedCount(userName) {
    if (!userName || !canUseLocalStorage()) return 0;
    return parseInt(localStorage.getItem(`designed:${userName}`), 10) || 0;
  },

  async setDesignedCount(userName, count) {
    if (!userName || !canUseLocalStorage()) return;
    localStorage.setItem(`designed:${userName}`, String(parseInt(count, 10) || 0));
  },
};
