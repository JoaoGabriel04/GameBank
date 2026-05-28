import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const ROOM_JWT_SECRET = process.env.ROOM_JWT_SECRET || JWT_SECRET;

export interface JwtPayload {
  userId: number;
  email: string;
}

export interface RoomJwtPayload {
  sessionId: number;
  playerId?: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function signRoomToken(payload: RoomJwtPayload): string {
  return jwt.sign(payload, ROOM_JWT_SECRET, { expiresIn: "1d" });
}

export function verifyRoomToken(token: string): RoomJwtPayload {
  return jwt.verify(token, ROOM_JWT_SECRET) as RoomJwtPayload;
}

export function getRoomTokenExpiry(): number {
  return 24 * 60 * 60 * 1000; // 1 dia em ms
}

export function getRoomTokenRefreshThreshold(): number {
  return 6 * 60 * 60 * 1000; // 6h em ms
}
