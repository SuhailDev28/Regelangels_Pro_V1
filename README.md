# Gymnastics Scoring App (MERN + MongoDB Atlas) — Admin CRUD Edition

## What you get
- Groups: create / edit / delete
- Activities: create / edit / delete
- Judges: create / edit / deactivate (soft delete)
- Participants: create / edit / delete (deletes profile + deactivates login)
- Judge assignments: map judge -> allowed groups + activities
- Judge scoring: only assigned groups/activities
- Leaderboard (total points per group)
- Awards + certificate PDF (admin any participant / participant self)

## Quick Start (Local)

### 1) Server
```bash
cd server
cp .env.example .env
# set MONGODB_URI + JWT_SECRET
npm install
npm run seed:admin
npm run dev
```

### 2) Client
```bash
cd ../client
cp .env.example .env
npm install
npm run dev
```

Open: http://localhost:5173

Admin demo:
- admin@demo.com / Admin@12345

Certificate endpoints:
- Admin (any participant): GET /api/admin/certificate/:participantId.pdf
- Participant (self): GET /api/participant/certificate/me.pdf
