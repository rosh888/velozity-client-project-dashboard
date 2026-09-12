import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { Errors } from "../lib/errors";
import {
  assertProjectReadAccess,
  assertProjectWriteAccess,
  projectWhereForUser,
} from "../services/scope";

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    where: projectWhereForUser(req.user!),
    include: {
      client: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: projects });
});

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) throw Errors.notFound("Project not found");
  assertProjectReadAccess(req.user!, project);
  res.json({ success: true, data: project });
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, clientId } = req.body;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw Errors.badRequest("Client does not exist");

  const project = await prisma.project.create({
    data: { name, description, clientId, ownerId: req.user!.id },
    include: { client: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: project });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) throw Errors.notFound("Project not found");
  assertProjectWriteAccess(req.user!, project);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: req.body,
  });
  res.json({ success: true, data: updated });
});
