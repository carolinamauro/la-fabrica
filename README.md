# MARTE Training

Mobile web app where athletes see their training plan (read from the coach's Google Sheets). See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Run locally

1. Create `.env.local` with:

   ```
   AUTH_SECRET=            # npx auth secret  (or: openssl rand -base64 32)
   AUTH_GOOGLE_ID=         # Google OAuth client ID
   AUTH_GOOGLE_SECRET=     # Google OAuth client secret

   GOOGLE_SERVICE_ACCOUNT_EMAIL=        # client_email from the service account JSON key
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=  # private_key from the JSON key, on one line with \n
   MASTER_SPREADSHEET_ID=               # ID of the live master file (the part after /d/ in its URL)
   CROSSFIT_SPREADSHEET_ID=             # ID of the shared CrossFit file
   ```

   Service account: Google Cloud Console → enable **Google Sheets API** → IAM → Service accounts → create one → Keys → Add key (JSON).
   Share the master file, the CrossFit file and the athletes' folder with the service account email as **Viewer**.
   The master must be a native Google Sheet (not an uploaded `.xlsx`).

   Only emails listed with `Estado = ACTIVO` in the master `ATLETAS` tab can sign in.

   Google OAuth client: Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → "Web application".
   Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add the Vercel URL later).

2. `npm install`
3. `npm run dev` → http://localhost:3000

`reference/` holds the real spreadsheets exported as `.xlsx` and is gitignored — never commit it.
