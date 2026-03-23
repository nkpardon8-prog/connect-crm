# Authentication

> Login flow, role-based access control, and auth gating.

**Status:** Active
**Last Updated:** 2026-03-22
**Related Docs:** [OVERVIEW.md](./OVERVIEW.md) | [state-management.md](./state-management.md) | [architecture.md](./architecture.md)

---

## Overview

Authentication is a Supabase Auth implementation using email/password authentication with session persistence. The login page calls `supabase.auth.signInWithPassword()` via the AuthContext, which validates credentials and returns a JWT. Sessions are persisted across page refreshes via Supabase's built-in session management. There are two roles — `admin` and `employee` — which control data visibility and feature access throughout the app.

---

## File Map

| File | Purpose |
|------|---------|
| `src/pages/LoginPage.tsx` | Login form UI with async submit and loading state |
| `src/contexts/AuthContext.tsx` | Auth state, Supabase login/logout logic, session management, role derivation |
| `src/App.tsx` | `AuthGate` component — loading state check, then user check |
| `src/lib/supabase.ts` | Supabase client used by AuthContext |

---

## Detailed Behavior

### Login Flow

```
User enters email + password
    │
    ▼
LoginPage calls login(email, password) [async, with loading state]
    │
    ▼
AuthContext calls supabase.auth.signInWithPassword()
    │
    ├── Error → returns false → LoginPage shows error message
    │
    └── Success → Supabase validates credentials, returns JWT
                          │
                          ▼
                    onAuthStateChange fires SIGNED_IN event
                          │
                          ▼
                    AuthContext fetches profile from profiles table
                          │
                          ▼
                    Sets user state → AuthGate re-renders
                          │
                          ▼
                    CRMProvider + Routes rendered → Dashboard shown
```

### Login Page UI

- Centered card on muted background
- "IntegrateAPI" branding (blue "I" icon)
- Email input (required, type="email")
- Password input (required, type="password")
- "Sign in" button (full width)
- Loading state on submit button (disabled + "Signing in..." text)
- Error message display (red text, shown on failed login)
- try/catch/finally for network error handling
- Demo credentials section showing test accounts

### Demo Credentials

| Account | Email | Password |
|---------|-------|----------|
| Admin | sarah@integrateapi.ai | admin123 |
| Employee | marcus@integrateapi.ai | employee123 |
| Employee | aisha@integrateapi.ai | employee123 |

### Role-Based Access Control

The `isAdmin` boolean (derived from `user.role === 'admin'`) controls visibility across the app:

| Feature | Admin View | Employee View |
|---------|-----------|---------------|
| Dashboard title | "Team Dashboard" | "Welcome back, [Name]" |
| Dashboard data | All leads/activities/deals | Only assigned items |
| Leads table | All leads + "Assigned Rep" column | Only assigned leads |
| Lead detail | All leads accessible | Only assigned leads |
| Pipeline | All deals + assigned rep display | Only assigned deals |
| Team leaderboard | Visible | Hidden |
| Team management (Settings) | Visible with user list | Hidden |
| Outreach | All emails | All emails (no filtering) |

### Auth Gating (AuthGate Component)

Located in `src/App.tsx`. Checks `loading` first, then `user`:
```typescript
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <BrandedSpinner />;
  if (!user) return <LoginPage />;
  return (
    <CRMProvider>
      <Routes>...</Routes>
    </CRMProvider>
  );
}
```

- `loading` is `true` on initial mount while Supabase restores any existing session — shows a branded spinner to prevent flash of login page
- No route-level guards — entire app is behind a single auth check
- CRMProvider is only rendered when authenticated
- NotFound route is inside the authenticated block (404 only for logged-in users)

### refreshUser()

`refreshUser() → Promise<void>` — Re-fetches the current user's profile from Supabase and updates the user state. Uses `supabase.auth.getSession()` to get the session-based user ID, then queries the `profiles` table directly. Called after profile edits in the Settings page to ensure the UI (sidebar display name, profile card) reflects the saved changes without requiring a page reload.

### Logout

- Triggered by "Sign out" button in sidebar footer (`AppSidebar.tsx`)
- Calls `logout()` from AuthContext, which calls `supabase.auth.signOut()` and immediately clears `user` state
- `onAuthStateChange` fires SIGNED_OUT event, confirming the state clear
- AuthGate re-renders, showing LoginPage

---

## Known Limitations & TODOs

- No "remember me" functionality
- No registration / sign-up flow
- No password reset / forgot password
- No email verification
- No rate limiting on login attempts
- No account lockout
- NotFound page is inside auth gate — unauthenticated users can't see 404s
- No route-level permissions (admin routes accessible to employees via URL)

---

## Future Considerations

- Add protected route wrapper that checks `isAdmin` for admin-only pages
- Consider OAuth/SSO integration (Google, Microsoft) via Supabase Auth providers
- Add session refresh/expiry handling (Supabase handles refresh tokens automatically, but explicit expiry UI may be useful)
- Add registration flow (Supabase `signUp` is available)
- Add password reset flow (Supabase `resetPasswordForEmail` is available)

---

## Changelog

| Date | Change | Files Affected |
|------|--------|----------------|
| 2026-03-22 | Initial documentation created | — |
| 2026-03-22 | Auth wired to Supabase — real login, session persistence, JWT tokens | `AuthContext.tsx`, `LoginPage.tsx`, `App.tsx` |
| 2026-03-23 | Added refreshUser function to AuthContext | `AuthContext.tsx` |
