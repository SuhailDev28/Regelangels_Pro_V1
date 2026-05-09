# Rebel Angels Gymnastics Scoring System

A full-stack enterprise-grade gymnastics competition and academy management platform built for **Rebel Angels**.

This system has evolved from a basic scoring application into a broader operational platform that supports:

- competition scoring
- multi-academy administration
- parent access
- public leaderboard display
- event enrollment
- certificates
- alerts and notifications
- finance and payment records
- academy activation workflows
- super admin reporting and oversight

---

# Overview

The Rebel Angels Gymnastics Scoring System is designed to manage gymnastics events, participant registrations, judges, scores, results, awards, and academy operations from a single platform.

It includes separate role-based experiences for:

- **Super Admin**
- **Admin**
- **Judge**
- **Parent**
- **Public / TV Display**

The application is built with a modern stack:

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Realtime:** Socket.IO
- **PDF / Certificates:** PDFKit + pdf-lib
- **File Uploads:** Multer
- **Authentication:** JWT / token-based auth
- **Deployment:** Render-ready architecture

---

# Current System Status

This README reflects the major updates completed so far in the project.

## Implemented and upgraded areas

### Core competition system
- user authentication
- role-based authorization
- participant management
- group management
- activity management
- judge assignments
- scoring workflow
- totals and rankings
- awards and certificates
- public verification routes

### Enterprise admin enhancements
- improved admin dashboard
- responsive admin interfaces
- academy-aware filtering
- academy switcher for super admin
- bulk operations for participants
- CSV import and export support
- event enrollment management
- stronger modal, filter, and pagination flows
- more stable API integrations

### Multi-academy support
- academy entity support
- academy-scoped data handling
- selected academy persistence
- academy-bound admin access
- super admin cross-academy control
- academy registration / activation flow
- academy deletion handling improvements

### Parent portal
- parent dashboard
- child list visibility
- event browsing
- result access
- certificate access
- payment history support
- notification support
- better enterprise-ready UI structure

### Judge experience
- judge dashboard
- onboarding flow
- draft score saving
- event and activity assignment flow
- score status options
- improved UX for scoring and submission
- safer state handling and refresh behavior

### Public display / TV mode
- live leaderboard display
- Socket.IO powered updates
- reconnect and room rejoin support
- animated row movement
- numeric tweening
- auto-rotation between groups
- fullscreen support
- visibility-aware refresh logic
- enterprise-style TV presentation

### Certificates
- certificate template workflow
- PDF generation support
- overlay support
- certificate download support
- certificate verification route
- upload and metadata support for certificate templates

### Finance / registration
- event enrollment records
- payment model integration
- invoice / fee related support in backend structure
- parent-facing payment visibility
- registration fee workflow groundwork

### Notifications / alerts
- alert model support
- notification-oriented architecture
- admin-to-parent notification direction prepared and partially integrated in dashboard flows

### Super admin reporting
- dashboard summary
- academy registry support
- scoped analytics
- finance summary
- attendance summary
- pending approvals
- coach performance
- enrollment trend support
- certificate statistics
- live leaderboard preview logic

---

# Main Features

## 1. Authentication and roles

The system supports multiple roles:

- **SUPER_ADMIN**
- **ADMIN**
- **JUDGE**
- **PARENT**

Each role sees a different interface and has different permissions.

### Example permissions
- **Super Admin**
  - manage academies
  - cross-academy analytics
  - platform-wide reporting
  - advanced oversight
- **Admin**
  - manage participants
  - manage events and activities
  - assign judges
  - manage results and certificates
- **Judge**
  - view assigned activities
  - enter and update scores
  - save scoring drafts
- **Parent**
  - view children
  - check results
  - access certificates
  - view events and payments

---

## 2. Multi-academy architecture

The project has been upgraded toward enterprise multi-academy usage.

### Supported behavior
- academy-aware API requests
- academy-bound admins
- super admin academy switching
- academy-specific participants and enrollments
- academy registration / activation
- academy cleanup and delete behavior
- scalable architecture for multiple organizations under one platform

---

## 3. Participant management

The participant module has received major upgrades.

### Supported capabilities
- create participant profiles
- edit participant details
- delete participant profiles
- full delete handling
- enroll participants into events
- bulk enroll participants
- bulk remove participants from events
- filter participants
- paginate participant list
- mobile / tablet / desktop responsive layouts
- CSV import and sample download
- report export support

### UI improvements
- desktop data table
- compact tablet layout
- stacked mobile cards
- filter sidebar
- modal-based interaction
- portal-safe selector components

---

## 4. Events, groups, and activities

Admins can structure competitions using:

- events
- groups
- activities
- participant enrollments
- judge assignments

This creates a flow where:
1. event is created
2. groups are assigned
3. activities are attached
4. judges are assigned
5. participants are enrolled
6. scores are entered
7. totals and rankings are calculated
8. awards and certificates are generated

---

## 5. Judge scoring system

The judge experience is optimized for live event use.

### Features
- assigned-event based workflow
- assigned-activity based scoring
- status selection:
  - SCORED
  - ABSENT
  - DQ
  - RETRY
  - WITHDRAWN
- draft autosave support
- debounced save behavior
- onboarding guidance
- cleaner navigation and error handling

This helps reduce scoring mistakes during live events.

---

## 6. Public leaderboard and TV mode

The leaderboard has been upgraded into an enterprise-style live display.

### Key enhancements
- stable Socket.IO connection
- auto rejoin on reconnect
- FLIP row animation
- hot-row highlighting
- animated score transitions
- group auto-rotation
- fallback refresh support
- fullscreen mode
- connection badge
- live clock
- responsive public presentation

This mode is ideal for:
- TV displays
- projector screens
- reception display boards
- event halls

---

## 7. Parent dashboard

The parent area is designed to improve visibility and self-service.

### Parent dashboard includes
- overview tab
- children data
- events list
- results visibility
- certificates visibility
- payments history
- notifications
- search and child filtering support

### Benefits
- reduces admin follow-up load
- improves parent engagement
- centralizes event and result access

---

## 8. Certificates and PDF workflows

Certificate generation is a major part of the system.

### Capabilities
- upload certificate template PDF
- store certificate template metadata
- generate certificate PDFs
- generate overlay-based certificates
- download certificate outputs
- verify certificate through public routes

### Backend support
- PDFKit generation
- pdf-lib merging / overlay workflows
- certificate-related models and utilities

---

## 9. Alerts and notifications

The project contains notification-oriented architecture to support real-time and administrative communication.

### Current direction
- admin-generated alerts
- parent-facing notifications
- dashboard integration
- future-ready expansion for broader notification delivery

---

## 10. Super admin system

The super admin module has been expanded significantly.

### Capabilities
- academy CRUD
- platform-level summaries
- branch / academy / scoped analytics
- finance overview
- attendance overview
- approval monitoring
- coach performance monitoring
- event enrollment trends
- certificate statistics
- live leaderboard preview

This creates a central command layer for organization-wide control.

---

# Tech Stack

## Frontend
- React
- Vite
- React Router
- Socket.IO Client

## Backend
- Node.js
- Express

## Database
- MongoDB
- Mongoose

## Auth / Security
- bcryptjs
- JWT-style token auth
- role-based route protection

## Validation and utilities
- zod
- crypto
- fs / path
- archiver

## Uploads and PDFs
- multer
- PDFKit
- pdf-lib

---

# Project Structure

A typical high-level structure looks like this:

```bash
project-root/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Admin/
│   │   │   ├── Public/
│   │   │   ├── Parent/
│   │   │   ├── Judge/
│   │   │   └── ...
│   │   ├── lib/
│   │   ├── components/
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── uploads/
│   │   ├── db.js
│   │   └── index.js
│   ├── package.json
│   └── .env
│
└── README.md
```

---

# Important Models in the Backend

The backend currently references and uses models such as:

- `User`
- `Group`
- `Activity`
- `Participant`
- `JudgeAssignment`
- `Score`
- `Award`
- `Alert`
- `Certificate`
- `Event`
- `EventEnrollment`
- `Payment`
- `Academy`
- `AcademyRegistration`
- `Invoice`
- `Fee`

Depending on your current branch/version, some modules may be more mature than others, but the architecture already supports a broad enterprise scope.

---

# Main Backend Route Areas

The server includes route groups such as:

- `auth.routes.js`
- `admin.routes.js`
- `admin.events.routes.js`
- `judge.routes.js`
- `participant.routes.js`
- `public.routes.js`
- `verify.routes.js`
- `superadmin.routes.js`

These routes collectively cover:
- authentication
- admin operations
- event operations
- judge workflows
- participant access
- public leaderboard and verification
- super admin oversight

---

# Realtime Architecture

Socket.IO is used to improve the live event experience.

## Used for
- public leaderboard updates
- live score display behavior
- TV mode refresh patterns
- event-style instant feedback

## Benefits
- less manual page refreshing
- smoother public display
- better event-day experience

---

# Environment Variables

Below is a practical template for the environment variables used by the system.

## Backend `.env`

```env
PORT=8080
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
APP_URL=https://your-frontend-domain.com
CLIENT_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
UPLOAD_DIR=uploads
```

You may also have optional variables depending on integrations, such as:
- payment gateway keys
- email / SMTP credentials
- certificate settings
- cloud storage settings

## Frontend `.env`

```env
VITE_API_BASE=https://your-backend-domain.com/api
```

### Example used in deployment
```env
VITE_API_BASE=https://rebelangels-v5-2backend.onrender.com/api
```

---

# Local Development Setup

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd <your-project-folder>
```

## 2. Install backend dependencies

```bash
cd server
npm install
```

## 3. Create backend environment file

Create `server/.env` and add your values.

## 4. Install frontend dependencies

```bash
cd ../client
npm install
```

## 5. Create frontend environment file

Create `client/.env` and add:

```env
VITE_API_BASE=http://localhost:8080/api
```

## 6. Start backend

```bash
cd server
npm run dev
```

## 7. Start frontend

```bash
cd client
npm run dev
```

---

# Production Deployment

The project has been structured for Render-style deployment.

## Frontend
Typical frontend deployment flow:
- connect frontend repo/service
- install dependencies
- run build
- deploy static output

## Backend
Typical backend deployment flow:
- connect backend repo/service
- install dependencies
- start Node server
- configure environment variables
- connect MongoDB

## Important production notes
- make sure frontend `VITE_API_BASE` points to the backend `/api`
- make sure backend CORS allows frontend origin
- do not use `:8080` in the frontend API URL unless your deployed backend actually requires it
- ensure uploads directories exist in production if local storage is used
- confirm MongoDB connection and secrets are configured correctly

---

# Completed UI / UX Improvements So Far

## Admin side
- more professional dashboard presentation
- improved sidebar styling
- better responsive behavior
- safer loading and state flows
- enterprise-style information blocks

## Participants page
- full responsive modes
- better filtering
- modals and confirmations
- CSV and bulk actions
- academy-aware requests

## Leaderboard TV
- smoother animations
- full screen capability
- live clock
- live refresh improvements
- stronger reconnect logic

## Parent dashboard
- clearer tabbed layout
- payments / results / certificates grouping
- event and child filtering
- notification-ready structure

## Judge dashboard
- onboarding
- stronger scoring UX
- draft and debounce support
- cleaner live scoring workflow

---

# Certificate Template Workflow

A dedicated certificate template upload and metadata flow has been prepared.

## Typical flow
1. admin uploads certificate template PDF
2. template metadata is saved
3. participant / award data is merged
4. certificate is generated
5. final file is downloaded or verified

This allows flexible branded certificate generation without redesigning the whole PDF each time.

---

# Data Flow Summary

## Competition flow
1. admin creates event
2. admin creates groups and activities
3. participants are added
4. participants are enrolled into events
5. judges are assigned
6. judge enters scores
7. totals are computed
8. results appear in admin and public views
9. awards and certificates are generated
10. parents can view results and certificates

## Academy activation flow
1. academy registration is created
2. activation token/link is sent or used
3. admin account is activated
4. academy becomes operational in the system

---

# Security and Validation Notes

The application uses several protection patterns:

- password hashing with bcrypt
- protected routes with auth middleware
- role-based access middleware
- zod validation patterns
- server-side request checking
- scoped academy access
- safer state handling in frontend

Additional security hardening can still be expanded depending on production needs.

---

# Known Architectural Strengths

- modular route structure
- scalable model-based backend
- role-separated UI
- multi-academy direction
- realtime leaderboard support
- PDF certificate support
- super admin oversight capability
- deployment-ready separation of client and server

---

# Suggested Next Expansion Areas

These items have either been discussed, partially prepared, or are natural next steps:

- full notification center
- push / email notification delivery
- complete online payment gateway integration
- PWA install and offline enhancements
- multi-parent / family account support
- deeper finance dashboards
- attendance tracking enhancements
- stronger audit logs
- cloud file storage support
- report exports in more formats
- advanced analytics and insights

---

# Troubleshooting Notes

## API not connecting
Check:
- `VITE_API_BASE`
- backend base URL
- CORS configuration
- deployed domain correctness

## Frontend works but backend fails
Check:
- Render environment variables
- MongoDB connection
- backend start command
- missing model imports
- file upload directory permissions

## Public leaderboard not updating
Check:
- Socket.IO server setup
- room join logic
- fallback refresh behavior
- client reconnection logic

## Certificate generation issues
Check:
- template PDF upload
- metadata existence
- PDF utility functions
- file permissions for uploads/temp files

## Academy data not loading
Check:
- selected academy state
- academy-aware request headers or params
- backend academy filtering logic
- super admin vs admin role behavior

---

# Recommended Scripts

## Backend
```json
{
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js"
  }
}
```

## Frontend
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Adjust based on your current package files.

---

# Example User Roles in Practice

## Super Admin
Manages the whole platform across academies.

## Admin
Runs day-to-day event, participant, and scoring operations for a specific academy.

## Judge
Handles event scoring only for assigned activities.

## Parent
Tracks children, results, certificates, events, and payments.

## Public Viewer
Sees leaderboard and public result-style displays without logging in.

---

# Why This Project Matters

This is not just a scoring tool anymore.

It has been progressively upgraded into a broader **competition + academy operations platform** that supports real event execution, parent communication, academy onboarding, public presentation, and enterprise reporting.

The architecture is moving toward a production-grade system that can serve:
- one academy
- multiple branches
- multiple academies
- branded events
- public competitions
- family-facing access

---

# Credits

Built and expanded for **Rebel Angels** with a focus on:

- live event usability
- professional admin operations
- scalable academy architecture
- polished public presentation
- enterprise readiness

---

# Maintainer Notes

When updating this project in the future, keep this README aligned with:
- newly added models
- new route groups
- new dashboards
- payment and notification integrations
- deployment changes
- environment variables
- role permissions
- setup instructions

---

# Quick Start Summary

```bash
# backend
cd server
npm install
npm run dev

# frontend
cd client
npm install
npm run dev
```

Frontend:
```env
VITE_API_BASE=http://localhost:8080/api
```

Backend:
```env
PORT=8080
MONGO_URI=your_mongo_uri
JWT_SECRET=your_secret
APP_URL=http://localhost:5173
```

---

# Final Note

This README is intended to document the system as it stands after the major rounds of upgrades completed so far. If your current codebase includes newer changes beyond these, update the corresponding sections for accuracy.
