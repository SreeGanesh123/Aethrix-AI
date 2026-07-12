# AETHRIX AI Architecture

## System Overview

- Frontend: React + TypeScript + Tailwind CSS (`client/`)
- Backend: Node.js + Express (`server/`)
- Database: MongoDB Atlas via Mongoose
- AI Services: OpenAI / Gemini + resume analysis + question generation + interview analysis + recommendation engine
- Storage: Cloudinary for images/videos, plus Firebase Storage / AWS S3 for other file assets

## Architecture Flow

Frontend (React + Tailwind CSS)

        ↓

Backend (Node.js + Express)

        ↓

Database (MongoDB)

        ↓

AI Services
├── OpenAI API / Gemini API
├── Resume Analysis
├── AI Question Generator
├── AI Interview Analysis
├── Recommendation Engine

        ↓

Storage
├── Cloudinary (images/videos)
├── Firebase Storage / AWS S3

## Notes

- The backend currently connects to MongoDB using `MONGO_URI` in `server/.env`.
- The project uses Tailwind CSS in the frontend for responsive UI.
- Cloudinary is the preferred media upload provider for image and video assets.
- Firebase Storage or AWS S3 can be added for larger file storage needs or alternate asset storage.

## Setup & Development

Requirements: Node 18+, npm, MongoDB (Atlas or local)

1. Start the server

```bash
cd server
npm install
# create a .env file based on server/.env.example (if provided)
node server.js
```

2. Start the client

```bash
cd client
npm install
npm run dev
```

3. Build for production

```bash
cd client
npm run build
```

## Continuous Integration

A basic GitHub Actions workflow is included at `.github/workflows/ci.yml` that installs dependencies and builds the client on push and pull requests to `main`/`master`.

## Maintenance notes
- Debug `console.log` statements have been suppressed in the server to reduce noisy logs in production. Use a structured logger (winston/pino) for production-grade logging.
- Add unit/integration tests and a test runner (Vitest/Jest) for the client and Mocha/Jest for the server.

