import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/jwt";
import { findById, findByUsername } from "@/lib/repositories/userRepository";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour, matches the JWT's own expiresIn

/**
 * Looks up an existing user by username and, if found, issues a JWT and sets
 * it as an httpOnly cookie. Returns null if the username doesn't exist -
 * there is no self-registration, since the login form has no source for the
 * required `name`/`preferredTimezone` fields.
 */
export async function login(username: string) {
  const user = await findByUsername(username);
  if (!user) {
    return null;
  }

  const token = signToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return user;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Reads and verifies the session cookie, then fetches the current profile.
 * Returns null (never throws) for: no cookie, expired/tampered token, or a
 * token whose user id no longer exists in the database - callers should
 * treat all of these uniformly as "not authenticated".
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return findById(payload.sub);
}
