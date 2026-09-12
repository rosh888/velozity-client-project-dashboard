import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";

export const listClients = asyncHandler(async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json({ success: true, data: clients });
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  const client = await prisma.client.create({ data: req.body });
  res.status(201).json({ success: true, data: client });
});
