# HealthSync AI — Complete Production Deployment Guide

A step-by-step, beginner-friendly deployment handbook for deploying **HealthSync AI** to production using **Supabase** (Database & Auth), **Render** (FastAPI Backend with Docker & Tesseract OCR), and **Vercel** (Next.js 15 Frontend).

---

## 1. Architecture & Deployment Overview

```
 [User Browser / Mobile]
            │
            ├──────────────────────────────────────────┐
            ▼                                          ▼
   [Frontend on Vercel]                       [Backend on Render]
   Next.js 15 App Router                      FastAPI in Docker Container
   HTTPS: healthsync-ai.vercel.app            HTTPS: healthsync-backend.onrender.com
            │                                          │
            └────────────────────┬─────────────────────┘
                                 ▼
                    [Supabase Cloud Managed]
                    ├── PostgreSQL 15+ Database (RLS Enabled)
                    ├── Supabase Auth (JWT Tokens)
                    └── Private Storage (medical-documents)
```

---

## 2. Prerequisites
Before beginning deployment, ensure you have free accounts on:
1. **[GitHub](https://github.com/)** (to host your repository)
2. **[Supabase](https://supabase.com/)** (for PostgreSQL database, authentication & storage)
3. **[Render](https://render.com/)** (for hosting the Python/Docker backend)
4. **[Vercel](https://vercel.com/)** (for hosting the Next.js frontend)
5. **[Google AI Studio](https://aistudio.google.com/)** (optional, for Gemini Vision API key)

---

## 3. Step 1: Supabase Setup (Database, Auth & Storage)

### 3.1 Create Supabase Project
1. Log in to [Supabase](https://supabase.com/) and click **New Project**.
2. Name your project (e.g. `healthsync-ai-prod`).
3. Set a strong database password and choose your closest geographic region.
4. Click **Create new project** and wait 1–2 minutes for provisioning.

### 3.2 Retrieve Credentials
Go to **Project Settings** -> **API**:
- Copy the **Project URL** (`https://xxxxxxxxxxxx.supabase.co`) -> This is `SUPABASE_URL`.
- Copy the **anon public key** (`eyJh...`) -> This is `SUPABASE_KEY`.
- Copy the **service_role secret key** (`eyJh...`) -> This is `SUPABASE_SERVICE_ROLE_KEY`.
- Under **JWT Settings**, copy the **JWT Secret** -> This is `SUPABASE_JWT_SECRET`.

### 3.3 Apply SQL Migrations
In your Supabase project dashboard, navigate to **SQL Editor** in the left menu.
Run each of the following SQL migration files in exact numerical order:

1. **Migration 001**: Open `backend/migrations/001_initial_schema.sql`, copy all text, paste into the SQL Editor, and click **Run**.
2. **Migration 002**: Open `backend/migrations/002_row_level_security.sql`, copy all text, paste into the SQL Editor, and click **Run**.
3. **Migration 003**: Open `backend/migrations/003_medication_reminders.sql`, copy all text, paste into the SQL Editor, and click **Run**.
4. **Migration 004**: Open `backend/migrations/004_ai_assistant_rag.sql`, copy all text, paste into the SQL Editor, and click **Run**.
5. **Migration 005**: Open `backend/migrations/005_advanced_intelligence.sql`, copy all text, paste into the SQL Editor, and click **Run**.

*All 17 tables are now created with Row-Level Security and appropriate foreign keys.*

### 3.4 Create Private Storage Bucket
1. In Supabase, click **Storage** in the left menu.
2. Click **New bucket**.
3. Bucket name: `medical-documents`
4. Toggle **Public bucket**: **OFF** (Keep bucket strictly **Private**).
5. Click **Save bucket**.

---

## 4. Step 2: Push Repository to GitHub

```bash
git init
git add .
git commit -m "Production ready HealthSync AI codebase"
git branch -M main
git remote add origin https://github.com/<your-username>/healthsync-ai.git
git push -u origin main
```

---

## 5. Step 3: Deploy Backend on Render (FastAPI + Docker)

Render uses the included `backend/Dockerfile` to automatically install Linux dependencies, Tesseract OCR 5, and Python 3.12.

### 5.1 Create Web Service
1. Log in to [Render](https://render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository (`healthsync-ai`).
3. Set the following configuration:
   - **Name**: `healthsync-ai-backend`
   - **Region**: Choose closest to your Supabase region (e.g. Oregon).
   - **Runtime**: **Docker**
   - **Docker Command / Context**: leave root `.`
   - **DockerfilePath**: `backend/Dockerfile`
   - **Instance Type**: Starter or Free

### 5.2 Configure Backend Environment Variables
In the **Environment Variables** section on Render, add:

| Key | Value | Description |
|---|---|---|
| `ENVIRONMENT` | `production` | Production mode |
| `DEBUG` | `false` | Disable debug stacktraces |
| `HOST` | `0.0.0.0` | Bind to all interfaces |
| `PORT` | `8000` | Render port |
| `TESSERACT_CMD` | `/usr/bin/tesseract` | Linux Tesseract executable |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `SUPABASE_KEY` | `your-anon-public-key` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Supabase Service Role Key |
| `SUPABASE_JWT_SECRET` | `your-supabase-jwt-secret` | Supabase JWT Secret |
| `SUPABASE_STORAGE_BUCKET` | `medical-documents` | Supabase bucket name |
| `LLM_PROVIDER` | `gemini` | Gemini provider |
| `LLM_API_KEY` | `your-gemini-api-key` | Google Gemini API Key |
| `LLM_MODEL` | `gemini-1.5-flash` | Multimodal model name |
| `CORS_ORIGINS` | `https://healthsync-ai.vercel.app` | Your Vercel frontend URL |

### 5.3 Deploy
Click **Create Web Service**. Render will build the Docker container and start your FastAPI service.
Once complete, note your public backend URL:
`https://healthsync-ai-backend.onrender.com`

Verify by opening in your browser:
`https://healthsync-ai-backend.onrender.com/health` -> should return `{"status":"healthy",...}`.

---

## 6. Step 4: Deploy Frontend on Vercel (Next.js 15)

### 6.1 Import Project into Vercel
1. Log in to [Vercel](https://vercel.com/) and click **Add New...** -> **Project**.
2. Import your GitHub repository (`healthsync-ai`).
3. Set **Root Directory** to `frontend`.
4. Framework Preset will auto-detect **Next.js**.

### 6.2 Configure Frontend Environment Variables
In Vercel's **Environment Variables** settings, add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://healthsync-ai-backend.onrender.com` (Your Render backend URL without trailing slash) |
| `NEXT_PUBLIC_APP_NAME` | `HealthSync AI` |
| `NEXT_PUBLIC_APP_TAGLINE` | `Your Health. Connected. Intelligent. Organized.` |

### 6.3 Deploy
Click **Deploy**. Vercel will run `npm install --legacy-peer-deps` and `next build`.
Once deployment finishes, you will receive your live URL:
`https://healthsync-ai.vercel.app`

---

## 7. Step 5: Post-Deployment Verification Checklist

1. **CORS Alignment**: In Render backend environment variables, ensure `CORS_ORIGINS` contains your exact Vercel URL: `https://healthsync-ai.vercel.app`.
2. **Health Check**: Open `https://healthsync-ai-backend.onrender.com/health` and verify HTTP 200.
3. **Register New Patient**: Open your live Vercel URL, click **Get Started Free**, and register a test account.
4. **Upload Test Medical Document**: Upload a prescription or lab report PDF/PNG.
5. **Verify AI Extraction**: Confirm structured extraction completes and fields appear on the dashboard.
6. **Verify Timeline & Analytics**: Check `/timeline` and `/analytics` for rendered data points.
7. **Verify PDF Export**: Visit `/summary` and click **Download PDF Summary** to download a compiled report.
8. **Verify QR Sharing**: Create a temporary share link, copy the public URL, and open in an incognito tab without logging in.
9. **Verify Emergency Card**: Configure contacts and blood group in `/emergency` and test the public responder view.
