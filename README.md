# Xeno CRM

A modern, highly interactive Customer Relationship Management platform with a cinematic user interface.

## Live Demo
🌐 **Frontend Deployment:** [https://xeno-4e3a2pkxx-sai-shivaram-s-projects.vercel.app/](https://xeno-4e3a2pkxx-sai-shivaram-s-projects.vercel.app/)

## Architecture
This repository is organized as a monorepo containing three distinct services:
- `/frontend` - A Next.js 15 App Router frontend featuring complex Framer Motion animations, a cinematic sunbeam intro, and a modern "Nothing Tech" inspired glassmorphic UI.
- `/backend` - A Node.js backend using Prisma ORM.
- `/channel-service` - A Node.js microservice handling specific channel operations.

## Running Locally

To run the full stack locally, you need to start each service:

**1. Frontend**
```bash
cd frontend
npm install
npm run dev
```

**2. Backend**
```bash
cd backend
npm install
npx tsx index.ts
```

**3. Channel Service**
```bash
cd channel-service
npm install
npx tsx index.ts
```
