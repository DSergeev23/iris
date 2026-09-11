---
name: frontend-dev
description: |
  Frontend architecture and frontend-backend integration guide.
  TRIGGER when: building frontend that consumes a backend API, setting up API clients,
  React Query, typed fetch, tRPC client, OpenAPI generated client, auth flows in UI,
  refresh token handling, loading states, user-facing API error handling,
  file upload client flows, SSE/WebSocket client handling, polling,
  CORS/API base URL integration, type safety across frontend-backend boundary.
  DO NOT TRIGGER when: backend-only service architecture, database access only,
  backend production hardening only, server-only background jobs/caching,
  pure visual design/CSS work without frontend-backend integration.
license: MIT
metadata:
  category: frontend
  version: "1.0.0"
  split_from: fullstack-dev
  sources:
    - The Twelve-Factor App (12factor.net)
    - Clean Architecture (Robert C. Martin)
    - Domain-Driven Design (Eric Evans)
    - Patterns of Enterprise Application Architecture (Martin Fowler)
    - Martin Fowler (Testing Pyramid, Contract Tests)
    - Google SRE Handbook (Release Engineering)
    - ThoughtWorks Technology Radar
---

# Frontend Integration Practices



## MANDATORY WORKFLOW — Follow These Steps In Order

**When this frontend skill is triggered, you MUST follow this workflow before writing any code.**

### Step 0: Gather Requirements

Before scaffolding anything, ask the user to clarify (or infer from context):

1. **Stack**: Frontend framework and backend framework if relevant (e.g., React + Express, Vue + Django, Next.js API)
2. **App type**: SPA, SSR/Next.js app, full-stack monolith frontend, or frontend for microservice API?
3. **Data source**: REST, GraphQL, tRPC, OpenAPI generated client, or direct server actions?
4. **State/server data**: Plain fetch, React Query, SWR, tRPC hooks, generated SDK?
5. **Real-time**: Needed? If yes — SSE, WebSocket, or polling?
6. **Auth**: Needed? If yes — JWT, session, OAuth, third-party provider, httpOnly refresh cookie?

If the user has already specified these in their request, skip asking and proceed.

### Step 1: Architectural Decisions

Based on requirements, make and state these decisions before coding:

| Decision | Options | Reference |
|----------|---------|-----------|
| Frontend API client approach | Typed fetch / React Query / tRPC / OpenAPI codegen | [Section 5](#5-api-client-patterns-medium) |
| Auth strategy | JWT + refresh / session / third-party | [Section 6](#6-authentication--middleware-high) |
| Real-time method | Polling / SSE / WebSocket | [Section 11](#11-real-time-patterns-medium) |
| Error handling | API error mapping + user-facing messages | [Section 12](#12-cross-boundary-error-handling-medium) |
| Type safety | Shared types / OpenAPI / tRPC / GraphQL codegen | [Section 5](#5-api-client-patterns-medium) |

Briefly explain each choice (1 sentence per decision).

### Step 2: Scaffold with Checklist

Use the frontend-backend integration checklist below. Ensure ALL checked items are implemented — do not skip any.

### Step 3: Implement Following Patterns

Write code following the patterns in this document. Reference specific sections as you implement each part.

### Step 4: Test & Verify

After implementation, run these checks before claiming completion:

1. **Build check**: Ensure frontend compiles without errors
   ```bash
   cd client && npm run build
   ```
2. **API smoke test**: Verify the frontend can call key backend endpoints through the configured API client
3. **Integration check**: Verify CORS, API base URL, auth flow, token refresh, loading states, and error messages
4. **Real-time check** (if applicable): Open two browser tabs, verify changes sync

If any check fails, fix the issue before proceeding.

### Step 5: Handoff Summary

Provide a brief summary to the user:

- **What was built**: List of implemented frontend integration features
- **How to run**: Exact commands to start frontend and, if relevant, backend
- **What's missing / next steps**: Any deferred items, known limitations, or recommended improvements
- **Key files**: List the most important files the user should know about

## Scope

**USE this skill when:**
- Building a frontend that integrates with a backend API
- Setting up API clients, auth flows, file uploads, or real-time features on the client side
- Handling loading states, API errors, retries, refresh-token flows, and user-facing messages
- Choosing between typed fetch, React Query, tRPC, OpenAPI generated clients, GraphQL codegen, or polling/SSE/WebSocket client patterns
- Reviewing frontend-backend integration for architectural issues
- Verifying CORS/API base URL/auth boundary behavior from the frontend side

**NOT for:**
- Backend-only service architecture
- Database access implementation
- Server-only production hardening
- Pure database schema design without frontend-backend integration context
- Pure visual design/CSS work without API/integration concerns

## Quick Start — Frontend-Backend Integration Checklist

- [ ] **API client** configured (typed fetch wrapper, React Query, tRPC, or OpenAPI generated)
- [ ] **Base URL** from environment variable (not hardcoded)
- [ ] **Auth token** attached to requests automatically (interceptor / middleware)
- [ ] **Error handling** — API errors mapped to user-facing messages
- [ ] **Loading states** handled (skeleton/spinner, not blank screen)
- [ ] **Type safety** across the boundary (shared types, OpenAPI, or tRPC)
- [ ] **CORS** configured with explicit origins (not `*` in production)
- [ ] **Refresh token** flow implemented (httpOnly cookie + transparent retry on 401)

---

## Quick Navigation

| Need to… | Jump to |
|----------|---------|
| Set up API client from frontend | [5. API Client Patterns](#5-api-client-patterns-medium) |
| Implement auth flow in frontend | [6. Auth & Middleware](#6-authentication--middleware-high) |
| Upload files from frontend | [10. File Upload Patterns](#10-file-upload-patterns-medium) |
| Add real-time frontend features (SSE, WebSocket, polling) | [11. Real-Time Patterns](#11-real-time-patterns-medium) |
| Handle API errors in frontend UI | [12. Cross-Boundary Error Handling](#12-cross-boundary-error-handling-medium) |
| Coordinate backend contract and frontend type safety | [API Design](references/api-design.md) |
| Auth flow (JWT, refresh, Next.js SSR, RBAC) | [references/auth-flow.md](references/auth-flow.md) |
| CORS, env vars, environment management | [references/environment-management.md](references/environment-management.md) |

## Core Principles (7 Iron Rules)

```
1. ✅ Keep API integration isolated in a dedicated client layer
2. ✅ Never hardcode API URLs; use environment variables
3. ✅ Map API errors to user-facing messages
4. ✅ Handle loading, empty, error, and success states explicitly
5. ✅ Keep type safety across the boundary — shared types, tRPC, OpenAPI, or generated clients
6. ✅ Treat all server responses as untrusted until validated or typed
7. ✅ Never leak tokens or secrets into localStorage, URLs, logs, or client-visible config
```

## 5. API Client Patterns (MEDIUM)

The "glue layer" between frontend and backend. Choose the approach that fits your team and stack.

### Option A: Typed Fetch Wrapper (Simple, No Dependencies)

```typescript
// lib/api-client.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.detail || body?.message || `API error ${status}`);
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();  // from cookie / memory / context

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, data: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
};
```

### Option B: React Query + Typed Client (Recommended for React)

```typescript
// hooks/use-orders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Order { id: string; total: number; status: string; }
interface CreateOrderInput { items: { productId: string; quantity: number }[] }

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => apiClient.get<{ data: Order[] }>('/api/orders'),
    staleTime: 1000 * 60,  // 1 min
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderInput) =>
      apiClient.post<{ data: Order }>('/api/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Usage in component:
function OrdersPage() {
  const { data, isLoading, error } = useOrders();
  const createOrder = useCreateOrder();
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBanner error={error} />;
  // ...
}
```

### Option C: tRPC (Same Team Owns Both Sides)

```typescript
// server: trpc/router.ts
export const appRouter = router({
  orders: router({
    list: publicProcedure.query(async () => {
      return db.order.findMany({ include: { items: true } });
    }),
    create: protectedProcedure
      .input(z.object({ items: z.array(orderItemSchema) }))
      .mutation(async ({ input, ctx }) => {
        return orderService.create(ctx.user.id, input);
      }),
  }),
});
export type AppRouter = typeof appRouter;

// client: automatic type safety, no code generation
const { data } = trpc.orders.list.useQuery();
const createOrder = trpc.orders.create.useMutation();
```

### Option D: OpenAPI Generated Client (Public / Multi-Consumer APIs)

```bash
npx openapi-typescript-codegen \
  --input http://localhost:3001/api/openapi.json \
  --output src/generated/api \
  --client axios
```

### Decision: Which API Client?

| Approach | When | Type Safety | Effort |
|----------|------|-------------|--------|
| Typed fetch wrapper | Simple apps, small teams | Manual types | Low |
| React Query + fetch | React apps, server state | Manual types | Medium |
| tRPC | Same team, TypeScript both sides | Automatic | Low |
| OpenAPI generated | Public API, multi-consumer | Automatic | Medium |
| GraphQL codegen | GraphQL APIs | Automatic | Medium |

---

## 6. Authentication & Middleware (HIGH) — Frontend Auth Flow

> **Full reference:** [references/auth-flow.md](references/auth-flow.md) — JWT bearer flow, automatic token refresh, Next.js server-side auth, RBAC pattern, backend middleware order.

### Standard Middleware Order

```
Request → 1.RequestID → 2.Logging → 3.CORS → 4.RateLimit → 5.BodyParse
       → 6.Auth → 7.Authz → 8.Validation → 9.Handler → 10.ErrorHandler → Response
```

### JWT Rules

```
✅ Short expiry access token (15min) + refresh token (server-stored)
✅ Minimal claims: userId, roles (not entire user object)
✅ Rotate signing keys periodically

❌ Never store tokens in localStorage (XSS risk)
❌ Never pass tokens in URL query params
```

### RBAC Pattern

```typescript
function authorize(...roles: Role[]) {
  return (req, res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.some(r => req.user.roles.includes(r))) throw new ForbiddenError();
    next();
  };
}
router.delete('/users/:id', authenticate, authorize('admin'), deleteUser);
```

### Auth Token Automatic Refresh

```typescript
// lib/api-client.ts — transparent refresh on 401
async function apiWithRefresh<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await api<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await api<{ accessToken: string }>('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',  // send httpOnly cookie
      });
      setAuthToken(refreshed.accessToken);
      return api<T>(path, options);  // retry
    }
    throw err;
  }
}
```

---

## 10. File Upload Patterns (MEDIUM)

### Option A: Presigned URL (Recommended for Large Files)

```
Client → GET /api/uploads/presign?filename=photo.jpg&type=image/jpeg
Server → { uploadUrl: "https://s3.../presigned", fileKey: "uploads/abc123.jpg" }
Client → PUT uploadUrl (direct to S3, bypasses your server)
Client → POST /api/photos { fileKey: "uploads/abc123.jpg" }  (save reference)
```

**Backend:**
```typescript
app.get('/api/uploads/presign', authenticate, async (req, res) => {
  const { filename, type } = req.query;
  const key = `uploads/${crypto.randomUUID()}-${filename}`;
  const url = await s3.getSignedUrl('putObject', {
    Bucket: process.env.S3_BUCKET, Key: key,
    ContentType: type, Expires: 300,  // 5 min
  });
  res.json({ uploadUrl: url, fileKey: key });
});
```

**Frontend:**
```typescript
async function uploadFile(file: File) {
  const { uploadUrl, fileKey } = await apiClient.get<PresignResponse>(
    `/api/uploads/presign?filename=${file.name}&type=${file.type}`
  );
  await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  return apiClient.post('/api/photos', { fileKey });
}
```

### Option B: Multipart (Small Files < 10MB)

```typescript
// Frontend
const formData = new FormData();
formData.append('file', file);
formData.append('description', 'Profile photo');
const res = await fetch('/api/upload', { method: 'POST', body: formData });
// Note: do NOT set Content-Type header — browser sets boundary automatically
```

### Decision

| Method | File Size | Server Load | Complexity |
|--------|-----------|-------------|------------|
| Presigned URL | Any (recommended > 5MB) | None (direct to storage) | Medium |
| Multipart | < 10MB | High (streams through server) | Low |
| Chunked / Resumable | > 100MB | Medium | High |

---

## 11. Real-Time Patterns (MEDIUM)

### Option A: Server-Sent Events (SSE) — One-Way Server → Client

Best for: notifications, live feeds, streaming AI responses.

**Backend (Express):**
```typescript
app.get('/api/events', authenticate, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const unsubscribe = eventBus.subscribe(req.user.id, (event) => {
    send(event.type, event.payload);
  });
  req.on('close', () => unsubscribe());
});
```

**Frontend:**
```typescript
function useServerEvents(userId: string) {
  useEffect(() => {
    const source = new EventSource(`/api/events?userId=${userId}`);
    source.addEventListener('notification', (e) => {
      showToast(JSON.parse(e.data).message);
    });
    source.onerror = () => { source.close(); setTimeout(() => /* reconnect */, 3000); };
    return () => source.close();
  }, [userId]);
}
```

### Option B: WebSocket — Bidirectional

Best for: chat, collaborative editing, gaming.

**Backend (ws library):**
```typescript
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
wss.on('connection', (ws, req) => {
  const userId = authenticateWs(req);
  if (!userId) { ws.close(4001, 'Unauthorized'); return; }
  ws.on('message', (raw) => handleMessage(userId, JSON.parse(raw.toString())));
  ws.on('close', () => cleanupUser(userId));
  const interval = setInterval(() => ws.ping(), 30000);
  ws.on('pong', () => { /* alive */ });
  ws.on('close', () => clearInterval(interval));
});
```

**Frontend:**
```typescript
function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  useEffect(() => {
    const socket = new WebSocket(url);
    socket.onopen = () => setWs(socket);
    socket.onclose = () => setTimeout(() => /* reconnect */, 3000);
    return () => socket.close();
  }, [url]);
  const send = useCallback((data: unknown) => ws?.send(JSON.stringify(data)), [ws]);
  return { ws, send };
}
```

### Option C: Polling (Simplest, No Infrastructure)

```typescript
function useOrderStatus(orderId: string) {
  return useQuery({
    queryKey: ['order-status', orderId],
    queryFn: () => apiClient.get<Order>(`/api/orders/${orderId}`),
    refetchInterval: (query) => {
      if (query.state.data?.status === 'completed') return false;
      return 5000;
    },
  });
}
```

### Decision

| Method | Direction | Complexity | When |
|--------|-----------|------------|------|
| Polling | Client → Server | Low | Simple status checks, < 10 clients |
| SSE | Server → Client | Medium | Notifications, feeds, AI streaming |
| WebSocket | Bidirectional | High | Chat, collaboration, gaming |

---

## 12. Cross-Boundary Error Handling (MEDIUM)

### API Error → User-Facing Message

```typescript
// lib/error-handler.ts
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401: return 'Please log in to continue.';
      case 403: return 'You don\'t have permission to do this.';
      case 404: return 'The item you\'re looking for doesn\'t exist.';
      case 409: return 'This conflicts with an existing item.';
      case 422:
        const fields = error.body?.errors;
        if (fields?.length) return fields.map((f: any) => f.message).join('. ');
        return 'Please check your input.';
      case 429: return 'Too many requests. Please wait a moment.';
      default: return 'Something went wrong. Please try again.';
    }
  }
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Cannot connect to server. Check your internet connection.';
  }
  return 'An unexpected error occurred.';
}
```

### React Query Global Error Handler

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { onError: (error) => toast.error(getErrorMessage(error)) },
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});
```

### Rules

```
✅ Map every API error code to a human-readable message
✅ Show field-level validation errors next to form inputs
✅ Auto-retry on 5xx (max 3, with backoff), never on 4xx
✅ Redirect to login on 401 (after refresh attempt fails)
✅ Show "offline" banner when fetch fails with TypeError

❌ Never show raw API error messages to users ("NullPointerException")
❌ Never silently swallow errors (show toast or log)
❌ Never retry 4xx errors (client is wrong, retrying won't help)
```

### Integration Decision Tree

```
Same team owns frontend + backend?
│
├─ YES, both TypeScript
│   └─ tRPC (end-to-end type safety, zero codegen)
│
├─ YES, different languages
│   └─ OpenAPI spec → generated client (type safety via codegen)
│
├─ NO, public API
│   └─ REST + OpenAPI → generated SDKs for consumers
│
└─ Complex data needs, multiple frontends
    └─ GraphQL + codegen (flexible queries per client)

Real-time needed?
│
├─ Server → Client only (notifications, feeds, AI streaming)
│   └─ SSE (simplest, auto-reconnect, works through proxies)
│
├─ Bidirectional (chat, collaboration)
│   └─ WebSocket (need heartbeat + reconnection logic)
│
└─ Simple status polling (< 10 clients)
    └─ React Query refetchInterval (no infrastructure needed)
```

---

## 13. Production Hardening (MEDIUM) — Frontend Integration Awareness

### Health Checks

```typescript
app.get('/health', (req, res) => res.json({ status: 'ok' }));           // liveness
app.get('/ready', async (req, res) => {                                   // readiness
  const checks = {
    database: await checkDb(), redis: await checkRedis(), 
  };
  const ok = Object.values(checks).every(c => c.status === 'ok');
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks });
});
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  server.close();              // stop new connections
  await drainConnections();    // finish in-flight
  await closeDatabase();
  process.exit(0);
});
```

### Security Checklist

```
✅ CORS: explicit origins (never '*' in production)
✅ Security headers (helmet / equivalent)
✅ Rate limiting on public endpoints
✅ Input validation on ALL endpoints (trust nothing)
✅ HTTPS enforced
❌ Never expose internal errors to clients
```

---

## Anti-Patterns

| # | ❌ Don't | ✅ Do Instead |
|---|---------|--------------|
| 1 | Business logic in routes/controllers | Move to service layer |
| 2 | `process.env` scattered everywhere | Centralized typed config |
| 3 | `console.log` for logging | Structured JSON logger |
| 4 | Generic `Error('oops')` | Typed error hierarchy |
| 5 | Direct DB calls in controllers | Repository pattern |
| 6 | No input validation | Validate at boundary (Zod/Pydantic) |
| 7 | Catching errors silently | Log + rethrow or return error |
| 8 | No health check endpoints | `/health` + `/ready` |
| 9 | Hardcoded config/secrets | Environment variables |
| 10 | No graceful shutdown | Handle SIGTERM properly |
| 11 | Hardcode API URL in frontend | Environment variable (`NEXT_PUBLIC_API_URL`) |
| 12 | Store JWT in localStorage | Memory + httpOnly refresh cookie |
| 13 | Show raw API errors to users | Map to human-readable messages |
| 14 | Retry 4xx errors | Only retry 5xx (server failures) |
| 15 | Skip loading states | Skeleton/spinner while fetching |
| 16 | Upload large files through API server | Presigned URL → direct to S3 |
| 17 | Poll for real-time data | SSE or WebSocket |
| 18 | Duplicate types frontend + backend | Shared types, tRPC, or OpenAPI codegen |

---

## Common Issues

### Issue 1: "Where does this business rule go?"

**Rule:** If it involves HTTP (request parsing, status codes, headers) → backend controller. If it involves business decisions (pricing, permissions, rules) → backend service. If it touches the database → backend repository. Frontend should call the API client and display the result, not duplicate backend business logic.

### Issue 2: "Frontend API code is scattered everywhere"

**Symptom:** Components call `fetch` directly, hardcode API URLs, repeat auth headers, and each component handles errors differently.

**Fix:** Move API calls into a typed API client layer. Use React Query/tRPC/OpenAPI generated clients when appropriate. Components should consume hooks or client methods, not rebuild request logic.

### Issue 3: "Users see raw backend errors"

**Fix:** Use a cross-boundary error mapper. Field validation errors go next to inputs; auth errors trigger login/refresh flow; offline errors show a connection banner; unexpected 5xx errors show a safe generic message and are logged.

## Reference Documents

This skill includes deep-dive references for specialized topics. Read the relevant reference when you need detailed guidance.

| Need to… | Reference |
|----------|-----------|
| Write backend tests (unit, integration, e2e, contract, performance) | [references/testing-strategy.md](references/testing-strategy.md) |
| Validate a release before deployment (6-gate checklist) | [references/release-checklist.md](references/release-checklist.md) |
| Choose a tech stack (language, framework, database, infra) | [references/technology-selection.md](references/technology-selection.md) |
| Build with Django / DRF (models, views, serializers, admin) | [references/django-best-practices.md](references/django-best-practices.md) |
| Design REST/GraphQL/gRPC endpoints (URLs, status codes, pagination) | [references/api-design.md](references/api-design.md) |
| Design database schema, indexes, migrations, multi-tenancy | [references/db-schema.md](references/db-schema.md) |
| Auth flow (JWT bearer, token refresh, Next.js SSR, RBAC, middleware order) | [references/auth-flow.md](references/auth-flow.md) |
| CORS config, env vars per environment, common CORS issues | [references/environment-management.md](references/environment-management.md) |
