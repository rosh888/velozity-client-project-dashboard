import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import { env } from "../config/env";
import {
  hashToken,
  refreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? ("none" as const) : ("lax" as const),
  path: "/api/auth",
};

function publicUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function issueTokens(res: Response, userId: string, role: any) {
  const accessToken = signAccessToken({ sub: userId, role });

  const record = await prisma.refreshToken.create({
    data: { userId, tokenHash: "pending", expiresAt: refreshExpiryDate() },
  });
  const refreshToken = signRefreshToken(userId, record.id);
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  res.cookie(env.cookieName, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: refreshExpiryDate(),
  });

  return accessToken;
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw Errors.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw Errors.unauthorized("Invalid email or password");

  const accessToken = await issueTokens(res, user.id, user.role);
  res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.cookieName];
  if (!token) throw Errors.unauthorized("Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw Errors.unauthorized("Refresh token is invalid or expired");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Errors.unauthorized("Refresh token is no longer valid");
  }
  if (stored.tokenHash !== hashToken(token)) {
    throw Errors.unauthorized("Refresh token is no longer valid");
  }

  // Rotate on every use: the old token is dead the moment it's redeemed.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw Errors.unauthorized("Account no longer exists");

  const accessToken = await issueTokens(res, user.id, user.role);
  res.json({ success: true, data: { accessToken, user: publicUser(user) } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.cookieName];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // already invalid, nothing to revoke
    }
  }
  res.clearCookie(env.cookieName, { path: "/api/auth" });
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw Errors.unauthorized();
  res.json({ success: true, data: publicUser(user) });
});
