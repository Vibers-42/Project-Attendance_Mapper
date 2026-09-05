# Attendance Mapper

A full-stack attendance tracking system for classroom and placement-drive attendance, built for scan-based (barcode/QR/roll-number) check-in with a superadmin web dashboard for reporting and master-data management.

## Project structure

```
AM_mobile/
├── backend/               Node.js + Express + Prisma API (PostgreSQL / Supabase)
├── website/                Next.js superadmin web dashboard
├── attendance_admin_app/   Flutter mobile app (faculty — attendance + placement scanning)
├── admin-app/               Unused Expo/React Native boilerplate
└── render.yaml              Render deployment config for the backend
```

## Components

### `backend/`
Express API on Prisma ORM against PostgreSQL (hosted on Supabase). Handles:
- Faculty & Superadmin authentication (JWT)
- Classroom attendance sessions (create, scan, submit, complete) and their reporting/workbook exports
- Placement drive sessions (eligibility lists, live-session locking, Excel workbook reports)
- Student master data (upload/manage via Excel)

Key scripts (run from `backend/`):
```bash
npm run dev      # start with nodemon
npm start        # start (production)
npm run build    # npx prisma generate
```

Database migrations live in `backend/prisma/migrations`. Deploy pending migrations with:
```bash
npx prisma migrate deploy
```
This also runs automatically as part of the Render build command (see `render.yaml`).

### `website/`
Next.js admin dashboard used by Superadmins to manage students, faculty, and attendance reports (Workbook View / Session View), and to download consolidated Excel workbooks.

```bash
npm run dev      # dev server on :3001
npm run build
npm run lint
```

### `attendance_admin_app/`
Flutter app used by faculty to run attendance:
- **Session** — Superadmin creates session templates (metadata only, no room); faculty pick an active template, supply their room number, and scan.
- **Placement** — company/drive sessions with eligibility lists, OFFLINE/VIRTUAL modes, and QR-based self-check-in.

### `admin-app/`
Unused Expo boilerplate — not part of the active product.

## Deployment

- **Backend**: Render (`render.yaml`), connects to Supabase PostgreSQL via `DATABASE_URL`/`DIRECT_URL`.
- **Website**: Vercel, deployed from `main` via the GitHub integration.
- **Database**: Supabase (PostgreSQL).

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Node.js, Express, Prisma, PostgreSQL, ExcelJS, JWT |
| Website | Next.js, React, TanStack Query/Table, Tailwind, shadcn |
| Mobile | Flutter, Provider, Dio, Hive (offline persistence), mobile_scanner |
