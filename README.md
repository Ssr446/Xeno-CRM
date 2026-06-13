# Xeno CRM: Enterprise AI Orchestration Platform 🚀

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://xeno-crm-bice-kappa.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)]()
[![Node.js](https://img.shields.io/badge/Node.js-Backend-green?style=for-the-badge&logo=node.js)]()
[![Prisma](https://img.shields.io/badge/Prisma-ORM-blue?style=for-the-badge&logo=prisma)]()
[![Socket.io](https://img.shields.io/badge/Socket.io-WebSockets-black?style=for-the-badge&logo=socket.io)]()

<!-- 🖼️ PLACEHOLDER: HERO IMAGE / BANNER (Upload your image to the repository and name it 'hero_banner.png') -->
<div align="center">
  <img src="hero_banner.png" alt="Xeno CRM Hero Banner">
</div>

<br>

**Xeno CRM** is a modern, highly interactive Customer Relationship Management platform featuring a cinematic user interface, real-time WebSocket communication, and an autonomous Multi-Agent AI architecture. Designed with a "Nothing Tech" glassmorphic aesthetic, it delivers a premium, enterprise-grade experience.

---

## 🌟 Live Demo
Experience the full-stack application deployed live on the cloud:

👉 **[Try Xeno CRM Live Here (Frontend)](https://xeno-crm-bice-kappa.vercel.app/)**  
👉 **[Backend API Endpoint (Render)](https://xeno-crm-st4n.onrender.com)**

<!-- 🖼️ PLACEHOLDER: APPLICATION DEMO GIF / SCREENSHOT (Upload your GIF/Image to the repository and name it 'demo.png') -->
<div align="center">
  <br>
  <img src="demo.png" alt="Xeno CRM Demo">
  <p><i>Example of Xeno CRM's cinematic interface and Multi-Agent AI in action.</i></p>
</div>

---

## ✨ Key Business Features

- **Multi-Agent AI Architecture:** Instead of relying on a single large prompt, an Orchestrator AI delegates tasks to specialized sub-agents:
  - **Query Agent:** Translates human intent into raw SQLite database queries.
  - **Copywriter Agent:** Drafts personalized, high-converting marketing copy.
  - **Audience Agent:** Analyzes the demographic and calculates audience size.
- **Real-Time WebSocket Infrastructure:** Replaces traditional HTTP polling with persistent **Socket.io WebSockets**. Live campaign status updates (Drafting → Generating Audience → Executing) are pushed instantly to the dashboard.
- **P-Queue Concurrency Control:** Prevents rate-limiting and ensures 100% deliverability on massive campaigns by artificially controlling the concurrency of outgoing requests (e.g., simulating 5 requests/second).

---

## 🔒 Enterprise Security Aspects

1. **AI Output Sanitization:** The execution of AI-generated SQL queries is strictly sandboxed. The backend validates and sanitizes all generated queries to prevent SQL Injection (SQLi) attacks, enforcing strict `SELECT`-only permissions.
2. **Environment Variable Protection:** All API Keys (Groq/Gemini) and Database URLs are stripped from the source code and securely injected via Vercel/Render encrypted Environment Variables.
3. **CORS Configuration:** Cross-Origin Resource Sharing is strictly configured to ensure only the authorized Vercel frontend can interact with the backend API.

---

## 🏗️ Architecture & Tech Stack

This repository is organized as a full-stack monorepo:

- **/frontend**
  - **Framework:** Next.js 15 (App Router)
  - **Styling:** CSS Modules, "Nothing Tech" glassmorphic aesthetic
  - **Animations:** Framer Motion (Cinematic boot-up sequence and shared-layout transitions)
  - **Real-time:** `socket.io-client`
- **/backend**
  - **Runtime:** Node.js + Express
  - **Database:** SQLite via **Prisma ORM**
  - **AI Model:** Google Gemini / Groq Orchestrator
  - **Real-time:** `socket.io`

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
