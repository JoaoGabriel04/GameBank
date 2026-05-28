let _roomToken: string | null = null;

export function setRoomToken(token: string | null) {
  _roomToken = token;
}

export function getRoomToken(): string | null {
  return _roomToken;
}
