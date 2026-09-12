# Velozity Client Project Dashboard

Internal dashboard for a small agency to manage client projects, assign tasks, and
watch team activity in real time. Built for the Velozity Global Solutions full-stack
hiring assessment.

Three roles (Admin, Project Manager, Developer) share the same dashboard but see
different data, and that's enforced on the API, not just hidden in the UI. Task
status changes get logged to Postgres and pushed to connected clients over
Socket.IO, scoped to whatever each role is allowed to see. Overdue tasks get
flagged by a background job on a schedule, not recalculated every time someone
loads the page.

## Features

- JWT auth: access token in memory, rotating refresh token in an HttpOnly cookie
- Role-based authorization in Express middleware + per-request ownership checks
- Projects -> Tasks -> ActivityLog relational model with a real audit trail
- Live, role-filtered activity feed over Socket.IO with catch-up after reconnect
- Live "users online" count for the admin dashboard
- In-app notifications with a real-time unread badge, no polling
- Task filters (status/priority/due date range) that live in the URL query string
- node-cron job that flips overdue tasks on a schedule
- Seed script with realistic demo data across all three roles

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Realtime | Socket.IO |
| Background jobs | node-cron |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |

## Architecture

```
frontend/   React SPA: auth context, socket context, notifications context, pages
backend/
  src/
    routes/        Express routers, thin, wires middleware + controllers
    controllers/    request handling, calls services/prisma, no raw SQL
    middleware/     authenticate, requireRole, zod validate*, errorHandler
    services/       scope.ts (ownership rules), activityService, notificationService
    sockets/io.ts    Socket.IO server: auth handshake, rooms, presence
    jobs/           node-cron overdue scheduler
    validation/     Zod schemas per resource
  prisma/           schema.prisma, migrations/, seed.ts
```

Controllers stay thin. They validate through middleware, load the resource, run an
ownership check from `services/scope.ts`, then read/write through Prisma. Those
same ownership functions also gate the Socket.IO room-join handshake, so the "who
can see what" rule only lives in one place instead of being copy-pasted between
REST and sockets.

## Folder structure

```
velozity-client-project-dashboard/
├── frontend/
├── backend/
│   └── prisma/
├── docker-compose.yml
├── README.md
├── .gitignore
└── .env.example  (see backend/.env.example and frontend/.env.example)
```

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ (Docker or a local install)

## Local setup (Docker Postgres)

```bash
docker compose up -d
cd backend
cp .env.example .env      # adjust DATABASE_URL if you changed the compose port
npm install
npx prisma migrate deploy
npm run seed
npm run dev                # http://localhost:4000
```

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## Local setup (no Docker)

Point `DATABASE_URL` in `backend/.env` at any reachable Postgres instance (local
install or a free hosted one) and run the same migrate/seed/dev steps above. I
developed and tested this without Docker installed, against a plain local Postgres
instance instead, functionally the same as what `docker-compose.yml` gives an
evaluator.

## Environment variables

**backend/.env**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | API port, default 4000 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | separate signing secrets, don't commit real values |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | token lifetimes, default 15m / 7d |
| `COOKIE_NAME` | name of the HttpOnly refresh-token cookie |
| `CORS_ORIGIN` | exact frontend origin allowed by CORS + Socket.IO |

**frontend/.env**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | backend REST base URL |
| `VITE_SOCKET_URL` | backend Socket.IO origin |

## Database setup & migrations

```bash
cd backend
npx prisma migrate deploy   # apply committed migrations
npx prisma migrate dev      # create + apply a new migration while developing
npx prisma generate         # regenerate the Prisma client after a schema change
```

## Seed data

```bash
npm run seed
```

Creates 1 Admin, 2 Project Managers, 4 Developers, 3 clients, and 3 projects (5-6
tasks each) spread across every status, with at least 2 tasks already `OVERDUE`,
backdated `ActivityLog` entries so the feed isn't empty on first load, and a
handful of `Notification` rows. `npx prisma migrate reset` runs migrations + seed
together in one go.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@velozity.com | Admin@2026 |
| Project Manager | pm1@velozity.com | Manager@2026 |
| Project Manager | pm2@velozity.com | Manager@2027 |
| Developer | dev1@velozity.com | Developer@2026 |
| Developer | dev2@velozity.com | Developer@2027 |
| Developer | dev3@velozity.com | Developer@2028 |
| Developer | dev4@velozity.com | Developer@2029 |

## Running frontend & backend

Backend: `cd backend && npm run dev` (tsx watch, port 4000).
Frontend: `cd frontend && npm run dev` (Vite, port 5173).
Production builds: `npm run build` in each folder (backend emits to `dist/`,
frontend emits static assets to `dist/`).

## API overview

Everything is under `/api`. Protected routes need `Authorization: Bearer <accessToken>`.

```
POST   /auth/login              email+password -> accessToken + user, sets refresh cookie
POST   /auth/refresh            rotates the refresh cookie -> new accessToken
POST   /auth/logout             revokes the refresh token, clears the cookie
GET    /auth/me

GET    /clients                 Admin, PM
POST   /clients                 Admin

GET    /projects                Admin sees all, PM sees own, role-gated
POST   /projects                Admin, PM (creator becomes owner)
GET    /projects/:id            ownership checked in the controller
PATCH  /projects/:id            ownership checked in the controller

GET    /tasks                   ?status&priority&from&to&projectId&page&pageSize, scoped by role
POST   /tasks                   Admin, PM (must own the project)
GET    /tasks/:id               ownership checked (dev: only if assigned)
PATCH  /tasks/:id               Admin, PM (own project)
PATCH  /tasks/:id/status        Admin, PM (own), Developer (own assigned task)

GET    /activity                ?after&limit, role-scoped feed + missed-event catch-up
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all

GET    /dashboard               shape depends on req.user.role
GET    /users                   Admin, PM (for assignee pickers)
POST   /users                   Admin
```

Every response is `{ success: true, data, meta? }` or
`{ success: false, error: { code, message, details? } }`. No stack traces ever
reach the client, see `middleware/errorHandler.ts`.

## Role / permission model

Enforcement lives in `backend/src/services/scope.ts`, not scattered through
controllers, and not in the frontend. Two layers:

- **Role gate** (`requireRole` middleware) - is this endpoint even open to this
  role at all. Coarse: a Developer never reaches `POST /projects`.
- **Ownership check**, run inside the controller after loading the resource
  (`assertProjectReadAccess`, `assertTaskStatusAccess`, etc.) - does *this* user
  own or get assigned *this specific row*. Role alone can't catch a PM reading
  another PM's project by guessing its UUID; only comparing `req.user.id` against
  the loaded row's `ownerId`/`assigneeId` can.

| | Admin | Project Manager | Developer |
|---|---|---|---|
| Projects | all | own only | none (403) |
| Tasks | all | own projects' tasks | own assigned tasks only |
| Task status update | any | own projects | own assigned tasks |
| Activity feed | global | own projects | own tasks |
| Users | manage | view (for assignment) | - |

The same `scope.ts` functions gate the Socket.IO `project:join`/`task:join`
handshake too, so a client can't just ask to join another project's room. The
server re-checks ownership before letting the socket in.

## WebSocket architecture

**Why Socket.IO instead of raw `ws`:** reconnection with backoff, room-based
broadcast (which does most of the work for role filtering here), and a polling
fallback if a proxy blocks WebSocket upgrades. All of that would otherwise have to
be built by hand for a project this size, and rooms + reconnection are exactly
what the "role-filtered feed" and "catch up after reconnect" requirements need.

**Rooms** (`backend/src/sockets/io.ts`):
- `user:<id>` - every socket joins its own room, used for personal notifications
  and (for developers) task activity even off the project page
- `global` - Admin only, every activity event and the presence count broadcast here
- `project:<id>` - a PM auto-joins this for every project they own on connect, or
  joins on demand via a `project:join` event that's re-checked server-side against
  `assertProjectReadAccess`
- `task:<id>` - joined on demand via `task:join` (used by the task detail page),
  re-checked against `assertTaskReadAccess`

On a task status change the server writes the `ActivityLog` row first, then emits
`activity:new` to `global` + `project:<projectId>` + `task:<taskId>`, and also
mirrors it to `user:<assigneeId>` so the assigned developer sees it even from their
dashboard rather than the project page. A Developer only ever receives events for
their own tasks, a PM only for projects they own, and that's because of room
membership, not the client throwing away events it wasn't supposed to see.

## Missed activity / reconnect catch-up

`GET /activity?after=<ISO timestamp>&limit=20` is the source of truth, there's no
in-memory activity cache anywhere. `useActivityFeed` on the frontend remembers the
timestamp of the newest event it has, loads the latest 20 on mount, and re-queries
`/activity?after=<that timestamp>` every time the socket fires `connect` (covers
first connect and every reconnect after a drop). That query runs through the same
role-scoping function used everywhere else (`activityWhereForUser` in `scope.ts`),
so what you can catch up on is exactly what you were allowed to see live.

## Background scheduler

`backend/src/jobs/overdueTaskJob.ts` runs every 5 minutes (`*/5 * * * *`) via
node-cron. It looks for tasks with `dueDate < now` still sitting in
`TODO`/`IN_PROGRESS`/`IN_REVIEW`, flips them to `OVERDUE`, and writes a normal
`ActivityLog` row for each one, attributed to a dedicated non-loginable `System`
account since `ActivityLog.actorId` is a real foreign key and there's no logged-in
user during a cron tick. This is not computed at request time: a task that just
crossed its due date shows as overdue from the seed data or the next scheduler
tick, never recalculated per request.

**Why node-cron instead of Bull:** Bull needs Redis as a broker, which is one more
moving piece to run and document for a single lightweight periodic job with no
need for retries or distributed workers. node-cron is just an in-process
scheduler, which is the right tool here. Bull would make sense if this job needed
to run across multiple backend instances or be queued as retryable units of work.

## Refresh token storage & security

- Refresh tokens sit in an HttpOnly cookie scoped to `path=/api/auth`, never
  readable by JavaScript, never in `localStorage`. `secure: true` and
  `sameSite: "none"` in production, `sameSite: "lax"` in development over plain HTTP.
- The access token only lives in memory on the frontend (`api/client.ts`). A hard
  refresh loses it and the app silently re-mints one from the refresh cookie via
  `POST /auth/refresh`.
- Refresh tokens rotate on every use: each `RefreshToken` row is looked up by its
  JWT `jti`, its SHA-256 hash gets compared against the stored hash, and it's
  marked `revokedAt` the moment it's redeemed, so a stolen already-used token can't
  be replayed. Logout revokes the current row explicitly.
- Only a hash of the refresh token is stored, not the raw value, so a database
  leak alone doesn't hand out usable tokens.

## Database schema

Full source of truth is `backend/prisma/schema.prisma`. Summary:

```
User ─┬─< ownedProjects (Project.ownerId)
      ├─< assignedTasks (Task.assigneeId)
      ├─< activityLogs (ActivityLog.actorId)
      ├─< notifications (Notification.userId)
      └─< refreshTokens (RefreshToken.userId)

Client ─< Project ─< Task ─< ActivityLog
                        └─< Notification (nullable Task FK)
```

- `Role`, `TaskStatus`, `Priority`, `NotificationType` are Postgres enums via Prisma.
- `Task.assigneeId` and `Notification.taskId` are nullable: a task can be
  unassigned, and a notification can outlive its task via `onDelete: SetNull`.
- `ActivityLog` stores `fromStatus` (null on creation), `toStatus`, the acting
  user, and a pre-rendered `message`, written at the moment of the change and
  never derived from current task state. History survives later edits.

### Indexing decisions

| Index | Why |
|---|---|
| `User.email` (unique) | every login is a lookup by email |
| `User.role` | `GET /users?role=DEVELOPER` for assignee pickers |
| `RefreshToken.userId`, `.expiresAt` | lookup on refresh, pruning expired rows |
| `Project.ownerId` | the PM-scoping `where: { ownerId }` runs on nearly every project/task query |
| `Project.clientId` | project-by-client lookups |
| `Task.projectId` | project detail page loads all of a project's tasks |
| `Task.assigneeId` | developer task list, assignee-scoped activity/notification queries |
| `Task.status`, `Task.priority`, `Task.dueDate` | the exact fields the `/tasks` filter endpoint queries on |
| `ActivityLog.[projectId, createdAt]` (composite) | the project feed always filters by project and sorts by time, one composite index covers both |
| `ActivityLog.taskId` | task detail page's activity history |
| `ActivityLog.createdAt` | the `after`-cursor catch-up query |
| `Notification.[userId, isRead]` (composite) | unread count and "list my unread" are the two hot queries |

Didn't add indexes to low-cardinality columns that only get queried after another
indexed field already narrows things down. No standalone index on `Task.priority`
on top of `status`, since Postgres can use one index and filter the rest cheaply
at this data volume.

## Validation & error handling

Every request body/query/params object goes through a Zod schema in
`middleware/validate.ts` before it reaches a controller, so invalid input never
reaches Prisma. `middleware/errorHandler.ts` catches `ZodError` (422,
`VALIDATION_ERROR`), a custom `AppError` (its own mapped status/code), and
anything else (500, generic message, full error only logged server-side, never
sent to the client).

## Deployment notes

- **Frontend -> Vercel**: set `VITE_API_URL` and `VITE_SOCKET_URL` to the deployed
  backend's URL in Vercel's env vars, framework preset "Vite", root directory
  `frontend`.
- **Backend -> any Node host that keeps a persistent process** (Render, Railway,
  Fly.io, a small VM), not a serverless function, since Socket.IO needs a
  long-lived process to hold WebSocket connections. Set `DATABASE_URL`,
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (the deployed
  frontend's exact origin), and `NODE_ENV=production`. Run
  `npx prisma migrate deploy` as a release step, then `npm run seed` once against
  the production database.
- **Database -> any hosted Postgres** (Neon, Supabase, Railway, RDS), point
  `DATABASE_URL` at it from the backend host's env vars.

## Known limitations

- Presence ("users online now") lives in an in-memory `Map` on the API process.
  Fine for a single instance, would need a shared store like Redis behind a load
  balancer with more than one instance.
- No automated test suite, just manual/scripted verification of every
  authorization boundary while building this. For a project this size,
  hand-verifying the 25+ authorization and real-time cases directly against the
  running API and UI felt like a better use of the time available than a partial
  test harness.
- Task status transitions aren't locked to a strict state machine, a Developer can
  jump `TODO -> DONE` directly. The brief didn't ask for one, and every transition
  still gets fully logged in `ActivityLog` regardless of order.
- Built and tested without Docker or a system Postgres install on hand, against a
  plain local Postgres instance instead. Same schema and behavior either way,
  `docker-compose.yml` is there for anyone who does have Docker.
