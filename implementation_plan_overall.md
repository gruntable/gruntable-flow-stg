# Gruntable Flow — MVP Productionization Plan (Revised)

> **Purpose:** Cofounder review & alignment before execution.
> **Bandwidth:** 20 hours/week · **Deadline:** Before Week 3 of April (~Apr 13)

---

## Executive Summary

Turn the preMVP into a production MVP where:
- Users on **Bubble.io** click a product card → **seamlessly logged into** the React app
- Every workflow run is **charged** (pay-as-you-go, enforced in n8n as today)
- **Supabase Auth** manages sessions — no self-managed auth
- All endpoints (n8n + FastAPI) are protected by **JWT verification**
- React app served from our **own VM** (not public Vercel)
- Clean slate — new domain, existing preMVP stays live for 2-week transition

---

## Architecture (Before → After)

### Before (preMVP)

```
React (Vercel)  ──── all requests ────►  n8n (Azure VM)  ────►  PostgreSQL (Azure)
                 no auth, random UUID
```

### After (MVP)

```
                    ┌────────────────────────────────────┐
                    │           Bubble.io                 │
                    │  (user clicks product card)         │
                    └──────────┬─────────────────────────┘
                               │ POST /api/auth/generate-login-link
                               │ Headers: X-Bubble-Secret
                               │ Body: { db_user_id }
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FastAPI (Hostinger VM)                        │
│                                                                  │
│  /api/auth/generate-login-link  ← Bubble calls this             │
│  /api/payments/*                ← Payment-related endpoints      │
│                                                                  │
│  Validates: X-Bubble-Secret (for Bubble)                         │
│  Validates: Supabase JWT (for React, on payment endpoints)       │
└───────────────────────┬──────────────────────────────────────────┘
                        │ Supabase Admin API
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Supabase Auth                                │
│  Generates magic link → redirects user to React app              │
│  Issues JWT with app_metadata.db_user_id                         │
└──────────────────────────────────────────────────────────────────┘
                        │ User lands on /auth/callback
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                  React App (same VM, via Nginx)                   │
│                                                                  │
│  All outgoing requests include: Authorization: Bearer <JWT>      │
│  getUserId() reads db_user_id from Supabase session              │
└───────────────┬──────────────────────────────────────────────────┘
                │ JWT in every request
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     n8n (same VM or separate)                     │
│                                                                  │
│  Every webhook workflow starts with: "Validate JWT" step         │
│  Extracts db_user_id from token → uses as user_id               │
│  Billing/charging logic stays here for MVP                       │
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural decision:** React calls n8n directly (no FastAPI proxy) for all orchestrator and table operations. n8n validates the JWT on every request.

---

## Workstreams

### WS1 — Supabase Auth Setup
**Owner:** BE · **Effort:** ~1 day (~6–8h) · **Depends on:** Nothing

| Step | Detail |
|---|---|
| Create Supabase project | Note: `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET` |
| Provision ~400 users | Admin API: `POST /auth/v1/admin/users` per user, with `email_confirm: true` and `app_metadata: { db_user_id: "<UUID>" }`. No passwords. |
| Verify | Confirm users appear in Supabase Auth dashboard |

> [!NOTE]
> Supabase's `auth.users.id` is its own UUID. Our `db_user_id` lives in `app_metadata` and is what the entire system reads from the JWT.

---

### WS5 — CI/CD + Hosting Infrastructure *(moved up)*
**Owner:** DevOps · **Effort:** ~1–2 days (~8–12h) · **Depends on:** Nothing

> [!IMPORTANT]
> CI/CD infrastructure setup is **independent of WS3**. The Nginx server, DNS, SSL, and GitHub Actions pipeline can all be configured before the React auth refactor is done. The only step that depends on WS3 is the **first production deploy** of the updated app — that runs automatically once WS3 code is merged.

| Step | Detail |
|---|---|
| Nginx on the VM | Install Nginx, serve React static files at `flow.gruntable.com` |
| Custom domain | DNS A record → VM IP |
| SSL | Let's Encrypt / Certbot |
| Reverse proxy | `flow.gruntable.com/api/*` → FastAPI |
| GitHub Actions pipeline | `npm ci` → `npm run build` → deploy `dist/` to VM via SSH |
| Smoke test | Deploy current (preMVP) build to confirm pipeline works end-to-end |

```nginx
# Simplified Nginx config
server {
    server_name flow.gruntable.com;

    # React SPA
    location / {
        root /var/www/gruntable-flow/dist;
        try_files $uri $uri/ /index.html;
    }

    # FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

---

### WS2 — FastAPI: Auth Endpoint + Payment
**Owner:** BE · **Effort:** ~2 days (~12–16h) · **Depends on:** WS1

#### Magic Link Endpoint

```
POST /api/auth/generate-login-link
Headers: X-Bubble-Secret: <shared-secret>
Body: { "db_user_id": "<UUID>" }
```

Logic:
1. Verify `X-Bubble-Secret`
2. Look up user email from DB using `db_user_id`
3. Call Supabase Admin `POST /auth/v1/admin/generate_link` → get `action_link`
4. Return `{ "login_url": action_link }`

#### Payment Endpoints

Existing payment logic (checking balance, managing subscriptions) stays on FastAPI. Endpoints verify the Supabase JWT to identify the user.

> [!NOTE]
> **Billing/charging per run stays in n8n for MVP.** Moving to FastAPI is a future optimization.

---

### WS3 — React Auth Refactor
**Owner:** FE · **Effort:** ~2–3 days (~14–20h) · **Depends on:** WS1

| File | Change |
|---|---|
| **[NEW]** `src/services/supabase.js` | Supabase client singleton (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| **[NEW]** `src/services/api.js` | `authenticatedFetch()` — wraps `fetch()`, injects `Authorization: Bearer <token>` from Supabase session |
| **[NEW]** `src/features/auth/AuthCallback.jsx` | Handles Supabase magic link redirect. Extracts `db_user_id` from `app_metadata`, writes to localStorage, redirects to workspace |
| **[NEW]** `src/features/auth/RequireAuth.jsx` | Route guard. No session → "Please log in from Gruntable dashboard" |
| **[MODIFY]** [src/main.jsx](file:///c:/Users/ERNEST%20HUTAPEA/gruntable-projects/gruntable-flow/src/main.jsx) | Add `/auth/callback` route. Wrap workspace routes with `RequireAuth` |
| **[MODIFY]** [src/services/user.js](file:///c:/Users/ERNEST%20HUTAPEA/gruntable-projects/gruntable-flow/src/services/user.js) | `getUserId()` reads from Supabase session `app_metadata.db_user_id`. Fallback to localStorage. Add `signOut()` |
| **[MODIFY]** [src/services/orchestrator.js](file:///c:/Users/ERNEST%20HUTAPEA/gruntable-projects/gruntable-flow/src/services/orchestrator.js) | Replace `fetch()` with `authenticatedFetch()`. **Rename `run_guid` → `run_group_id`** throughout |
| **[MODIFY]** [src/services/table.js](file:///c:/Users/ERNEST%20HUTAPEA/gruntable-projects/gruntable-flow/src/services/table.js) | Replace `fetch()` with `authenticatedFetch()` |
| **[MODIFY]** [src/features/workspace/hooks/useOrchestrator.js](file:///c:/Users/ERNEST%20HUTAPEA/gruntable-projects/gruntable-flow/src/features/workspace/hooks/useOrchestrator.js) | **Rename all `runGuid` / `run_guid` references → `runGroupId` / `run_group_id`** |
| **[MODIFY]** `.env` | Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FASTAPI_BASE_URL` |

---

### WS4 — n8n JWT Validation
**Owner:** BE / PM · **Effort:** ~1–2 days (~8–12h) · **Depends on:** WS1

Add a **"Validate JWT" node** at the top of every n8n webhook workflow:

1. Read `Authorization` header from the incoming webhook request
2. Extract the token (strip `Bearer ` prefix)
3. Verify signature using `SUPABASE_JWT_SECRET` (HS256)
4. Verify `aud` claim equals `"authenticated"`
5. Extract `app_metadata.db_user_id` → use as `user_id` for the rest of the workflow
6. If invalid → return `401 Unauthorized`

> [!TIP]
> Create the JWT validation as a reusable n8n sub-workflow that all webhooks call. This avoids duplicating logic across 9+ workflows.

**Workflows to update:** `/webhook/orchestrator/start|status|advance|cancel|node-complete`, `/webhook/table/read|replace|list|delete`

Also rename `run_guid` → `run_group_id` across all orchestrator workflows.

---

### WS6 — Session Expiry Handling
**Owner:** FE · **Effort:** ~0.5 day (~3–4h) · **Depends on:** WS3

- Supabase JS auto-refreshes access tokens using the refresh token
- When refresh token expires (default: 1 week of inactivity):
  - `onAuthStateChange` fires `SIGNED_OUT`
  - React shows "Session expired" screen with a link back to Bubble

---

## Revised Schedule (20h/week · Deadline: Apr 13)

```
Week 1 (Mar 17–23) · 20h available
────────────────────────────────────────
WS1: Supabase setup                ~8h   ← BE starts immediately, no deps
WS5: Nginx, DNS, SSL, GA pipeline ~12h   ← DevOps starts immediately, no deps

Week 2 (Mar 24–30) · 20h available
────────────────────────────────────────
WS2: FastAPI auth + payments       ~14h  ← BE (needs WS1 done)
WS4: n8n JWT validation (start)    ~6h   ← BE/PM (needs WS1 done)

Week 3 (Mar 31–Apr 6) · 20h available
────────────────────────────────────────
WS3: React auth refactor           ~16h  ← FE (needs WS1 done)
WS4: n8n JWT validation (finish)   ~4h   ← wrap up + test

Week 4 (Apr 7–13) · 20h available
────────────────────────────────────────
WS6: Session expiry handling       ~4h   ← FE (needs WS3)
WS5: First production deploy       ~2h   ← runs via CI/CD after WS3 merge
Integration testing (end-to-end)   ~8h   ← Bubble → FastAPI → Supabase → React → n8n
Bubble card configuration          ~4h   ← configure Bubble to call FastAPI endpoint
Buffer / fixes                     ~2h
```

> [!IMPORTANT]
> **Yes, this is feasible.** Total effort is ~70–84 hours across workstreams. You have ~80 hours of bandwidth by Apr 13. The schedule has a ~2-hour buffer built into Week 4 for unexpected issues.

---

## Key Dependency Change from Previous Plan

| | Previous Plan | Revised Plan |
|---|---|---|
| WS5 dependency | WS3 (full React refactor needed first) | **None** — infra runs independently |
| WS5 production deploy | Blocked until WS3 | Auto-triggers via CI/CD after WS3 merges |
| WS5 start | Week 2 | **Week 1** |
| Net savings | — | ~1 week earlier infra readiness |

---

## Open Issue: n8n iframe Forms

> [!IMPORTANT]
> n8n form URLs (for file upload in AI Extraction) are loaded in an iframe. The JWT cannot be passed via iframe easily. **The n8n form endpoints may need to remain unauthenticated**, or use a different mechanism (e.g., a short-lived token passed as a query parameter that the orchestrator generates at `/start` time). This needs investigation during WS4.

---

## Future Items (Post-MVP)

| Item | Notes |
|---|---|
| Move billing to FastAPI | Currently in n8n. Move for better control and auditing |
| Workflow persistence on server | Move from localStorage to DB-backed storage |
| Proxy all n8n through FastAPI | Stronger security, single entry point |
| Supabase DB migration | Move PostgreSQL from Azure to Supabase to reduce costs |
| RBAC / access control | Roles, team workspaces |
| Infrastructure migration | Azure → Hostinger for cost reduction |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| n8n iframe forms can't receive JWT | AI Extraction nodes break | Use short-lived token in query param, or keep forms unauthenticated with obscure URLs |
| Supabase magic link expires before user clicks | Login fails | Set expiry to 24h (configurable). Show clear error message |
| n8n JWT validation adds latency to polling | Slower UX during runs | JWT decode is ~1ms. Negligible vs 2s poll interval |
| User clears browser storage | Loses workflow config | Import/export feature exists. Auth session is cookie-based (survives localStorage clear) |
| Access token expires mid-run | API call gets 401 | Non-issue: Supabase client auto-refreshes tokens. Only fails after 1 week of complete inactivity |
