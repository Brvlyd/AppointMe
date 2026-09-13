import jwt from "jsonwebtoken";

export type SessionPayload = { sub: string; iat: number; exp: number };

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

/** Returns null for a missing, malformed, or expired token instead of throwing. */
export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as SessionPayload;
  } catch {
    return null;
  }
}
