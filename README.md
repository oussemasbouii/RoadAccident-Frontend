# RoadAccident-Frontend

Web admin portal for the Road Accident app (officers use the mobile app; admins use this app to manage alerts, incidents, reports, and users).

---

## Sign in as admin and manage users

### 1. Create an admin account (first time only)

- Open **Create Admin Account** from the login page (or go to `/auth/admin-signup`).
- Use an **institutional email** (domain is set in `VITE_INSTITUTIONAL_EMAIL_DOMAIN`, default `institution.gov`).
- Fill in password, name, and optional phone/center. Submit.
- The app calls `POST /auth/signup` with `role: 'admin'`. Your backend must accept this and create an admin user.

### 2. Sign in

- On the **login** page, sign in with the credentials your backend expects for that admin user (e.g. **Officer ID** and **password**, if your backend uses officerId for admins too).
- The app treats you as admin only if the **signin response** includes a user with **`role: 'admin'`** (or `userType`/`type`/`roles: ['admin']` – the app normalizes these).
- Ensure your backend returns that role in the login response (e.g. in `data.user.role` or `data.officer.role`).

### 3. Open Admin Accounts

- After login, the sidebar shows **Admin Accounts** only when `user.role === 'admin'`.
- Click **Admin Accounts** (or go to `/admin/accounts`). The route is protected: non-admins are redirected to the dashboard.
- The page loads the user list via **GET /users/** (using your `VITE_API_URL` base). You can search, validate users, change status (active/restricted/blocked), set a temporary password, and revoke sessions. Delete is disabled until the backend supports **DELETE /users/{id}**.

### 4. Development bypass (no backend)

- Set in `.env`: `VITE_DEV_BYPASS_LOGIN=true`.
- On the login page you’ll see **Continue in DEV mode (Admin)**. Click it to sign in as an admin without calling the backend.
- You’ll see the sidebar and can open **Admin Accounts**; the user list will stay empty or show an error until **GET /users/** is available.