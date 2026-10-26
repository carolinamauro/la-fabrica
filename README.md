# MARTE Training

Mobile web app where athletes see their training plan (read from the coach's Google Sheets). See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Run locally

1. Create `.env.local` with:

   ```
   AUTH_SECRET=            # npx auth secret  (or: openssl rand -base64 32)
   AUTH_GOOGLE_ID=         # Google OAuth client ID
   AUTH_GOOGLE_SECRET=     # Google OAuth client secret
   ```

   Google OAuth client: Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → "Web application".
   Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add the Vercel URL later).

2. `npm install`
3. `npm run dev` → http://localhost:3000

`reference/` holds the real spreadsheets exported as `.xlsx` and is gitignored — never commit it.
