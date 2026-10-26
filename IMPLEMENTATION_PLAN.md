# MARTE Training App — Implementation Plan (simple MVP)

**Goal:** athletes open an app on their phone and see their training in a clean, readable way instead of a spreadsheet.

**Principle:** the coach keeps working in Google Sheets exactly as today. The app reads the plans and writes in only one place: it **appends** the athlete's Carga/Reps per series to their `REGISTRO_PLANIFICACION`, in the same format the sheet already uses, so `DASHBOARD` and `HISTORIAL` keep working. It never edits existing cells, formulas or `MI_PLANIFICACION`.

---

## 1. What we build

| Screen | Content |
|---|---|
| Login | "Continue with Google" |
| Today / week | The current week and its days; tap a day |
| Workout | Blocks and exercises with sets, reps, RPE / %, rest and notes, in big readable cards |
| Anexo (CrossFit only) | The strength and gymnastics accessory plans, as two tabs |

Plus: installable on the home screen (PWA manifest + icon), a "refresh" pull, and a button "Abrir mi planilla" that opens the athlete's sheet to log loads as they do today.

**Logging (FUERZA):** under each exercise, one row per series (up to 6, like `MI_PLANIFICACION` I–T) with **Carga** and **Reps**, and a **Guardar** button. Saved values are prefilled; a correction is a new row (latest wins). E1RM / RATIO_BW are filled for exercises the catalog marks with `E1RM = SI`.

**Not in this version:** offline mode, marking the session complete (`CONTROL_SESIONES`), coach screens, payment lock, any database.

## 2. Stack

- Next.js (App Router) + TypeScript + Tailwind (+ a few shadcn/ui components)
- **Firebase Auth with Google** (account chooser) — the server verifies the Firebase token, checks the email in `ATLETAS` and sets its own session cookie. No database needed.
- `googleapis` with one **service account** (key only on the server, in Vercel env vars)
- Vercel hosting
- Vitest for the two parsers

## 3. How it works

```
Phone ──Google login──▶ Next.js on Vercel ──service account (read-only)──▶ Google Sheets
```

1. Athlete signs in with Google.
2. Server looks up the email in the master file, tab `ATLETAS` (`Mail`, `Estado = ACTIVO`). Not found → "Ask your coach to add your email".
3. `Tipo` decides what to read:
   - **FUERZA** → the athlete's own file (`Archivo` column).
   - **CROSSFIT** → the shared CrossFit file.
4. Server reads the sheet, converts it into simple JSON, and sends **only that athlete's workout** to the phone.
5. Data is cached ~60 s, so when the coach edits the sheet, athletes see it in about a minute.

**Access setup (one time):** create a service account, share the master file and the CrossFit file with it as **Viewer**, and the folder with all athlete files as **Editor**.

## 4. Reading the sheets

### FUERZA (personalized)

- **Current week/day:** whatever is selected in `MI_PLANIFICACION` `B3` (week) and `D3` (day) — "the one that is open in the sheet". The athlete can still move to other weeks/days in the app.
- **Exercises:** `BASE_PLANIFICACION` rows where `ID` = the athlete's ID (the file has other athletes' rows — they are filtered out on the server).
  Columns: `EJERCICIO, SERIES, REPETICIONES, OBJETIVO, DESCANSO, INTERVALO, NOTAS, ID, SEMANA, DIA, ORDEN`.
- **Grouping:** by the letter in `ORDEN` (`A1, A2, A3` → block A). Rows with `EJERCICIO = "WOD"` are shown as one text block using `NOTAS`.
- Values are shown as written (`"10+10"`, `"35 SEG"`, `"RPE 8"`) — no need to parse them into numbers just to display them.

### CROSSFIT

- **Days:** rows where column C says `DIA n`.
- **Blocks:** rows where column B says `ENTRADA EN CALOR` or `BLOQUE …`; the block's lines are the column C text below it.
- **Per exercise line:** the side columns of the current week group (`SERIES / REPS / RPE / %`) on the same row, when present.
- **Anexo:** the `ANEXO` tab grid (day × exercise × week 1–4 × series/reps/RPE/%), shown as "Fuerza" and "Gimnásticos" tabs.

> To confirm with one live example: which side column group is "this week" (the headers in the export are inconsistent and some columns are hidden). Easiest rule if the coach agrees: **the first visible group**.

## 5. Code layout

```
src/
  app/                 # pages + one API route per screen
  lib/
    firebase-client.ts # Google sign-in popup (browser)
    session.ts         # verify Firebase token, session cookie
    sheets.ts          # service account client + cache
    athletes.ts        # email → athlete (master ATLETAS)
    personalized.ts    # BASE_PLANIFICACION → Workout JSON
    crossfit.ts        # PLANIFICACIÓN / ANEXO → Workout JSON
    types.ts           # Workout, Block, Exercise
  components/          # WorkoutCard, ExerciseRow, WeekPicker…
tests/                 # parser tests with anonymized fixtures
```

```ts
type Workout = { week: string; day: string; blocks: Block[] };
type Block = { title: string; lines: string[]; exercises: Exercise[] };
type Exercise = { name: string; sets?: string; reps?: string; target?: string; rest?: string; notes?: string };
```

## 6. Security (the minimum that matters)

- Service account key only on the server; it can edit athlete files, but the app only appends rows to `REGISTRO_PLANIFICACION`.
- Results are saved for the signed-in athlete only, and only for exercises in their plan for that week/day; values are range-checked on the server.
- The athlete is always resolved from the login email, never from the URL.
- The phone only receives that athlete's workout — never raw rows, other athletes, or emails.

## 7. Tasks

| # | Task | Done when |
|---|---|---|
| 1 | Scaffold Next.js + Tailwind + Google login (Firebase) | Can log in on localhost |
| 2 | Service account + `sheets.ts` + `athletes.ts` | Logged‑in email resolves to the right athlete; unknown email is blocked |
| 3 | `personalized.ts` + tests | Your file shows the right week/day and exercises, no other athletes' rows |
| 4 | `crossfit.ts` (+ Anexo) + tests | All 5 days render with blocks and free text |
| 5 | Screens: week + workout + anexo, mobile layout | Readable on a phone, one‑hand navigation |
| 6 | PWA manifest/icons, deploy to Vercel | Installable on Android and iPhone; works with the live sheets |

Rough size: a few days of work.

## 8. Later (only if needed)

- Mark the session as completed from the app (`CONTROL_SESIONES`).
- Email‑code login for athletes without Google.
- Offline viewing.
