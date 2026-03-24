# Bubble.io → Supabase Auth → React App: Production SSO Guide

## Overview

**Goal:** A user on Bubble.io clicks a product card and is seamlessly logged into the Gruntable Flow React app — no separate registration or password required.

**Key constraints:**
- Use **your own DB's UUID** as the primary user identifier (not Bubble's `_id`).
- Use **Supabase Auth** as the managed auth provider (no self-managed JWT signing).
- Users do not have passwords in your DB, so a passwordless flow is required.
- FastAPI backend orchestrates the handoff.

```
┌───────────┐       ┌───────────────┐       ┌────────────┐       ┌──────────┐
│ Bubble.io │──①──▶ │ FastAPI       │──②──▶ │ Supabase   │──③──▶ │ React    │
│ (card)    │       │ Backend       │       │ Auth       │       │ App      │
└───────────┘       └───────────────┘       └────────────┘       └──────────┘

① Bubble calls FastAPI with the Bubble user_id
② FastAPI looks up your DB UUID, calls Supabase Admin to generate a login link
③ React app receives the session from Supabase, stores the DB UUID
```

---

## Part 1 — Supabase Project Setup

### Step 1: Create Supabase project
1. Go to [supabase.com](https://supabase.com) → "New Project".
2. Note your **Project URL** and **anon key** (public) and **service_role key** (secret, backend only).

### Step 2: Understand Supabase Auth user IDs
Supabase Auth creates its own UUID for every user in `auth.users`. You **cannot replace** this UUID — it is Supabase-internal. However, you can:
- Store your DB UUID in the user's `raw_user_meta_data` or `raw_app_meta_data` at creation time.
- Create a mapping table linking `supabase_auth_id ↔ your_db_uuid`.

> [!IMPORTANT]
> Supabase `auth.users.id` is controlled by Supabase and **cannot** be set to your own UUID. The recommended pattern is to store your UUID in `app_metadata.db_user_id` and always read from there in your app. This lets your entire app continue using your DB UUID while Supabase manages auth internally.

### Step 3: Create a user-mapping table (optional but recommended)
In the Supabase SQL Editor, run:

```sql
CREATE TABLE public.user_mapping (
  supabase_auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  db_user_id       UUID NOT NULL UNIQUE,   -- Your own DB UUID
  bubble_user_id   TEXT UNIQUE,            -- Bubble's _id (for reverse lookups)
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- RLS: only the service role should write; the user can read their own row
ALTER TABLE public.user_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mapping"
  ON public.user_mapping FOR SELECT
  USING (supabase_auth_id = auth.uid());
```

---

## Part 2 — Initial User Migration (Bulk-Provisioning)

Since you don't know user passwords, you **do not** create password-based accounts. Instead, you create Supabase Auth users with email-only (or a dummy provider) using the **Admin API** and immediately mark them as confirmed.

### Step 4: Write a one-time migration script

Use the Supabase Admin SDK (Python, via `supabase-py` or direct REST calls) from your FastAPI backend or a standalone script.

```python
# migrate_users.py — run once
import httpx, os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

def provision_user(db_uuid: str, email: str, bubble_id: str | None = None):
    """Create a Supabase Auth user for an existing DB user."""
    # 1. Create the user via Admin API (auto-confirms, no password)
    resp = httpx.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers,
        json={
            "email": email,
            "email_confirm": True,       # skip email verification
            "app_metadata": {
                "db_user_id": db_uuid,   # YOUR UUID lives here
                "bubble_user_id": bubble_id,
            },
        },
    )
    resp.raise_for_status()
    supabase_auth_id = resp.json()["id"]

    # 2. Insert into mapping table
    httpx.post(
        f"{SUPABASE_URL}/rest/v1/user_mapping",
        headers={**headers, "Prefer": "return=minimal"},
        json={
            "supabase_auth_id": supabase_auth_id,
            "db_user_id": db_uuid,
            "bubble_user_id": bubble_id,
        },
    )
    return supabase_auth_id


# Example: iterate over your existing DB users
# users = fetch_all_users_from_your_db()
# for u in users:
#     provision_user(u.id, u.email, u.bubble_id)
```

> [!NOTE]
> If a user does not have an email, you can generate a deterministic placeholder like `{db_uuid}@gruntable.internal`. Supabase requires an email, but since you will never use password login, the address doesn't need to be real.

---

## Part 3 — The "Click Card → Logged In" Flow (Magic Link via Backend)

This is the core SSO mechanism. The user never types a password.

### Step 5: Bubble.io — Create the product card

1. On your Bubble page, add a **Repeating Group** or individual **Group** element for each product card.
2. On the card's click event, add an action:
   - **Action type:** "API Connector" → call your FastAPI endpoint.
   - **URL:** `https://your-fastapi.com/api/auth/generate-login-link`
   - **Method:** POST
   - **Body (JSON):**
     ```json
     {
       "bubble_user_id": "Current User's unique id"
     }
     ```
3. The response will contain a `login_url`. Add a second action:
   - **Action type:** "Open an external website"
   - **Destination:** the `login_url` from the API response.

### Step 6: FastAPI — Generate a magic login link

```python
# app/routers/auth.py
from fastapi import APIRouter, HTTPException
import httpx, os

router = APIRouter(prefix="/api/auth")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
REACT_APP_URL = os.environ["REACT_APP_URL"]  # e.g. https://flow.gruntable.com

ADMIN_HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}


@router.post("/generate-login-link")
async def generate_login_link(body: dict):
    bubble_user_id = body.get("bubble_user_id")
    if not bubble_user_id:
        raise HTTPException(400, "bubble_user_id required")

    # 1. Look up your DB UUID from the mapping table (or your own DB)
    db_user = lookup_user_by_bubble_id(bubble_user_id)  # implement this
    if not db_user:
        raise HTTPException(404, "User not found")

    # 2. Find the Supabase Auth user by email (or by mapping table)
    #    Option A: Use Supabase Admin — generate a magic link
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/admin/generate_link",
            headers=ADMIN_HEADERS,
            json={
                "type": "magiclink",
                "email": db_user.email,
                "options": {
                    "redirect_to": f"{REACT_APP_URL}/auth/callback",
                },
            },
        )
    if resp.status_code != 200:
        raise HTTPException(500, f"Supabase error: {resp.text}")

    data = resp.json()
    # The response contains `action_link` — a one-time login URL
    login_url = data["action_link"]

    return {"login_url": login_url}
```

> [!WARNING]
> The `action_link` returned by Supabase's `generate_link` API is a **server-side** link that must be used directly. It contains a one-time token that expires (default: 24 hours, configurable). Make sure your FastAPI endpoint is secured (e.g., verify the request actually comes from Bubble using a shared API key header).

### Step 7: Secure the Bubble → FastAPI request

Add a shared secret:

```python
# In FastAPI — verify Bubble requests
from fastapi import Header

BUBBLE_API_SECRET = os.environ["BUBBLE_API_SECRET"]

@router.post("/generate-login-link")
async def generate_login_link(
    body: dict,
    x_bubble_secret: str = Header(...),
):
    if x_bubble_secret != BUBBLE_API_SECRET:
        raise HTTPException(403, "Invalid secret")
    # ... rest of the logic
```

In Bubble's API Connector, add a header:
- **Key:** `X-Bubble-Secret`
- **Value:** your shared secret string.

---

## Part 4 — React App: Receiving the Session

### Step 8: Install Supabase client

```bash
npm install @supabase/supabase-js
```

### Step 9: Create a Supabase client singleton

```js
// src/services/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Add to your `.env`:
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Step 10: Create the auth callback route

When Supabase's magic link is clicked, it redirects to `/auth/callback` with tokens in the URL hash. Supabase's client library automatically picks these up.

```jsx
// src/features/auth/AuthCallback.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';  // or your router
import { supabase } from '../../services/supabase.js';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase client auto-detects the hash tokens on this page
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Extract YOUR DB UUID from the session metadata
        const dbUserId = session.user.app_metadata?.db_user_id;

        if (dbUserId) {
          // Replace the old localStorage user_id with the real one
          window.localStorage.setItem('gruntable_user_id', dbUserId);
        }

        navigate('/');  // redirect to the main workspace
      }
    });
  }, [navigate]);

  return <div>Signing you in…</div>;
}
```

### Step 11: Refactor `user.js` to be Supabase-aware

```js
// src/services/user.js  (production version)
import { supabase } from './supabase.js';

const USER_ID_KEY = 'gruntable_user_id';

/**
 * Get the authenticated user's DB UUID.
 * Priority: Supabase session → localStorage fallback.
 */
export const getUserId = () => {
  // 1. Try Supabase session first
  //    (getSession is sync from cache after initial load)
  const sessionData = supabase.auth.getSession();
  // Note: getSession() returns a promise in v2;
  // use the cached user if available:
  const user = supabase.auth.getUser?.()  // sync cache in some versions

  // 2. Fallback to localStorage (backwards-compat during migration)
  return window.localStorage.getItem(USER_ID_KEY) || 'anonymous';
};

/**
 * Full async version — use this in service calls
 */
export const getUserIdAsync = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.app_metadata?.db_user_id) {
    const dbUserId = session.user.app_metadata.db_user_id;
    // Keep localStorage in sync
    window.localStorage.setItem(USER_ID_KEY, dbUserId);
    return dbUserId;
  }
  return window.localStorage.getItem(USER_ID_KEY) || 'anonymous';
};

/**
 * Sign out — clears both Supabase session and localStorage
 */
export const signOut = async () => {
  await supabase.auth.signOut();
  window.localStorage.removeItem(USER_ID_KEY);
};
```

### Step 12: Add a route guard (protect the workspace)

```jsx
// src/features/auth/RequireAuth.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase.js';

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setAuthenticated(!!session)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>Loading…</div>;
  if (!authenticated) return <div>Please log in from the Gruntable dashboard.</div>;
  return children;
}
```

---

## Part 5 — FastAPI Backend: Verifying Supabase JWTs

### Step 13: Validate tokens on your API endpoints

Every request from the React app should include the Supabase access token. Your FastAPI backend verifies it.

```python
# app/dependencies/auth.py
from fastapi import Depends, HTTPException, Request
from jose import jwt, JWTError
import os

SUPABASE_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]  # from Supabase dashboard → Settings → API

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing token")

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                             audience="authenticated")
    except JWTError:
        raise HTTPException(401, "Invalid token")

    db_user_id = payload.get("app_metadata", {}).get("db_user_id")
    if not db_user_id:
        raise HTTPException(401, "No db_user_id in token")

    return {"db_user_id": db_user_id, "supabase_id": payload["sub"]}
```

### Step 14: Update React's fetch calls to include the token

```js
// src/services/api.js  (new helper)
import { supabase } from './supabase.js';

export const authenticatedFetch = async (url, options = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};
```

Then replace `fetch` calls in `table.js` and other services with `authenticatedFetch`.

---

## Part 6 — End-to-End Flow Summary

```
1. User clicks product card on Bubble.io
       │
       ▼
2. Bubble POSTs to FastAPI /api/auth/generate-login-link
   with { bubble_user_id } + X-Bubble-Secret header
       │
       ▼
3. FastAPI looks up your DB UUID from bubble_user_id
   Calls Supabase Admin API: POST /auth/v1/admin/generate_link
   Returns { login_url } (one-time magic link)
       │
       ▼
4. Bubble opens the login_url in a new tab
       │
       ▼
5. Browser hits Supabase magic link → Supabase validates token
   → Redirects to https://flow.gruntable.com/auth/callback#access_token=...
       │
       ▼
6. React AuthCallback component:
   - Supabase JS client auto-parses the hash tokens
   - Extracts db_user_id from app_metadata
   - Stores it in localStorage as gruntable_user_id
   - Redirects to the workspace
       │
       ▼
7. All subsequent API calls (table read/write, orchestrator, etc.)
   include the Supabase Bearer token in the Authorization header.
   FastAPI validates the JWT and extracts db_user_id.
```

---

## Part 7 — Environment Variables Checklist

### React App (`.env`)
| Variable | Example |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |

### FastAPI Backend
| Variable | Example |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (secret — never expose to frontend) |
| `SUPABASE_JWT_SECRET` | From Supabase Dashboard → Settings → API → JWT Secret |
| `BUBBLE_API_SECRET` | A random string you also configure in Bubble's API Connector |
| `REACT_APP_URL` | `https://flow.gruntable.com` |

---

## Part 8 — Implementation Sequence (Checklist)

- [ ] **Supabase:** Create project, note URL + keys
- [ ] **Supabase:** Create `user_mapping` table + RLS policies
- [ ] **FastAPI:** Add migration script to bulk-provision existing DB users into Supabase Auth
- [ ] **FastAPI:** Run the migration script once
- [ ] **FastAPI:** Add `/api/auth/generate-login-link` endpoint
- [ ] **FastAPI:** Add JWT verification dependency for protected routes
- [ ] **React:** Install `@supabase/supabase-js`, create `supabase.js` client
- [ ] **React:** Add `/auth/callback` route + `AuthCallback` component
- [ ] **React:** Add `RequireAuth` route guard wrapping the workspace
- [ ] **React:** Refactor `user.js` to read UUID from Supabase session
- [ ] **React:** Create `authenticatedFetch` helper and update `table.js` + orchestrator calls
- [ ] **Bubble:** Configure API Connector to hit FastAPI with `bubble_user_id` + secret
- [ ] **Bubble:** Add card click action → call API → open returned `login_url`
- [ ] **Test:** End-to-end: click card → auto-login → workspace loads with correct user data
