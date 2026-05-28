const STORAGE_KEY = "room_token";

let _roomToken: string | null = null;

function loadFromStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveToStorage(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

_roomToken = loadFromStorage();

export function setRoomToken(token: string | null) {
  _roomToken = token;
  saveToStorage(token);
}

export function getRoomToken(): string | null {
  return _roomToken;
}
