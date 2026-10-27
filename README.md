# La Fábrica

Mobile web app where athletes see their training plan (read from the coach's Google Sheets). See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Run locally

1. Create `.env.local` with:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=        # Firebase → Project settings → General → Your apps → Web app config
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=    # e.g. your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=     # e.g. your-project
   SESSION_SECRET=                      # random string, 32+ chars: openssl rand -base64 32

   GOOGLE_SERVICE_ACCOUNT_EMAIL=        # client_email from the service account JSON key
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=  # private_key from the JSON key, on one line with \n
   MASTER_SPREADSHEET_ID=               # ID of the live master file (the part after /d/ in its URL)
   CROSSFIT_SPREADSHEET_ID=             # ID of the shared CrossFit file
   ```

   Service account: Google Cloud Console → enable **Google Sheets API** and **Google Drive API** (Drive is only used to read who the CrossFit file is shared with) → IAM → Service accounts → create one → Keys → Add key (JSON).
   Share the master file and the CrossFit file with the service account email as **Viewer**, and the athletes' folder as **Editor** (the app appends results to each athlete's `REGISTRO_PLANIFICACION` and fills the Carga/Reps cells of `MI_PLANIFICACION`).
   Each athlete file's `REGISTRO_PLANIFICACION` tab is protected ("SOLO COACH"): add the service account to that protection's editors too (Data → Protected sheets and ranges). `MI_PLANIFICACION` I6:T50 is already unprotected.
   The master must be a native Google Sheet (not an uploaded `.xlsx`).
   Athletes with a personalized plan also get a **CrossFit** tab when the CrossFit file is shared with their Google email (or their domain, or by link). If Drive only lets Viewers see part of the sharing list, make the service account an **Editor** of the CrossFit file.

   Only emails listed with `Estado = ACTIVO` in the master `ATLETAS` tab can sign in.

   Login (Firebase): Firebase console → Authentication → Sign-in method → enable **Google**.
   If the project has no web app yet: Project settings → General → Add app → Web, and copy `apiKey`, `authDomain`, `projectId`.
   `localhost` is already an authorized domain; nothing else to configure for local use.

2. `npm install`
3. `npm run dev` → http://localhost:3000

## Deploy (Vercel)

1. Push `main` to GitHub, then in Vercel: **Add New → Project → Import** `carolinamauro/la-fabrica` (framework is detected as Next.js).
2. Before deploying, add the same 8 environment variables as in `.env.local` (Settings → Environment Variables).
3. After the first deploy: Firebase console → Authentication → Settings → **Authorized domains** → add `<your-app>.vercel.app`.

Every push to `main` redeploys automatically.

## Install on the phone

- **iPhone (Safari):** Share → "Agregar a inicio".
- **Android (Chrome):** menu ⋮ → "Instalar app" / "Agregar a la pantalla principal".

`reference/` holds the real spreadsheets exported as `.xlsx` and is gitignored — never commit it.
