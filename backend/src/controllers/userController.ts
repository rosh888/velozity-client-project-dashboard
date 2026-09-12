import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import { SYSTEM_USER_EMAIL } from "../jobs/overdueTaskJob";

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.query as { role?: string };
  const users = await prisma.user.findMany({
    where: { email: { not: SYSTEM_USER_EMAIL }, ...(role ? { role: role as any } : {}) },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, data: users });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Errors.conflict("A user with this email already exists");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.status(201).json({ success: true, data: user });
});
