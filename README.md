# Xeno CRM: Enterprise AI Orchestration Platform

![Xeno CRM Hero Image Placeholder](Insert_Hero_Image_URL_Here)

A modern, highly interactive Customer Relationship Management platform featuring a cinematic user interface, real-time WebSocket communication, and an autonomous Multi-Agent AI architecture.

## 🌐 Live Deployments
- **Frontend (Vercel):** [https://xeno-crm-bice-kappa.vercel.app](https://xeno-crm-bice-kappa.vercel.app)
- **Backend API (Render):** [https://xeno-crm-st4n.onrender.com](https://xeno-crm-st4n.onrender.com)

---

## ✨ Key Business Features

### 1. Multi-Agent AI Architecture
Instead of relying on a single large prompt, Xeno CRM utilizes an advanced **Multi-Agent** design. When a user submits a campaign prompt, a master Orchestrator AI delegates tasks to three specialized sub-agents:
- **Query Agent:** Translates human intent into raw SQLite database queries.
- **Copywriter Agent:** Drafts personalized, high-converting marketing copy for the campaign.
- **Audience Agent:** Analyzes the target demographic and calculates total audience size.

### 2. Real-Time WebSocket Infrastructure
The platform replaces traditional HTTP polling with persistent **Socket.io WebSockets**. As the AI agents work in the background, live campaign status updates (Drafting → Generating Audience → Executing) are pushed instantly to the user's dashboard without refreshing the page.

### 3. P-Queue Concurrency Control
To prevent rate-limiting and ensure 100% deliverability on massive campaigns, the backend utilizes `p-queue` to artificially control the concurrency of outgoing requests (e.g. simulating email/SMS dispatches at 5 requests per second). 

![AI Agents Dashboard Placeholder](Insert_Dashboard_Image_URL_Here)

---

## 🔒 Enterprise Security Aspects

1. **AI Output Sanitization:** The execution of AI-generated SQL queries is strictly sandboxed. The backend validates and sanitizes all generated queries to prevent SQL Injection (SQLi) attacks. The system enforces strict `SELECT`-only permissions during execution.
2. **Environment Variable Protection:** All API Keys (Groq/Gemini API) and internal Database URLs are stripped from the source code and securely injected via Vercel/Render encrypted Environment Variables.
3. **CORS Configuration:** Cross-Origin Resource Sharing is implemented to strictly manage which frontends are legally allowed to interact with the backend API.

---

## 🏗️ Architecture & Tech Stack

This repository is organized as a full-stack monorepo:

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Styling:** CSS Modules, "Nothing Tech" inspired glassmorphic aesthetic
- **Animations:** Framer Motion (Cinematic boot-up sequence and shared-layout transitions)
- **Real-time:** `socket.io-client`

### Backend
- **Runtime:** Node.js + Express
- **Database:** SQLite via **Prisma ORM**
- **AI Model:** Google Gemini / Groq Orchestrator
- **Real-time:** `socket.io`

![Architecture Diagram Placeholder](Insert_Architecture_Diagram_URL_Here)

---

## 🚀 Running Locally

To run the full stack locally on your own machine:

**1. Clone & Install**
```bash
git clone https://github.com/Ssr446/Xeno-CRM.git
cd Xeno-CRM
```

**2. Start the Backend**
```bash
cd backend
npm install
npm start
```
*The backend will run on http://localhost:3001*

**3. Start the Frontend**
```bash
cd ../frontend
npm install
npm run dev
```
*The frontend will run on http://localhost:3000*
