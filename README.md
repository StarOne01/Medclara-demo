# MedClara Web Platform

**MedClara** is an AI-powered clinical documentation platform that automatically transcribes doctor-patient conversations in 110+ languages and generates accurate, template-ready medical reports in seconds. Designed for modern, multilingual healthcare practices, MedClara eliminates manual note-taking, reduces administrative burden by 50%, and reclaims 5+ hours of clinician time daily.

### Impact

- **5+ hours daily** - Clinicians reclaim time spent on manual documentation
- **110+ languages** - Multilingual transcription and report generation across global dialects
- **50% paperwork reduction** - Eliminate administrative friction and focus on patient care
- **Medical-grade accuracy** - HIPAA-compliant with confidence scoring and clinical entity extraction
- **54+ specialty templates** - Cardiology, pediatrics, psychiatry, and more—instantly customizable

MedClara combines a modern Next.js frontend with a robust Go backend powered by Google Vertex AI, delivering seamless integration into existing EHR workflows.

## 🛠️ Tech Stack

### Frontend

- **Next.js 15** - React 19 with App Router for server-side rendering and static site generation
- **TypeScript** - Type-safe component and API interactions
- **Tailwind CSS** - Utility-first CSS framework for responsive design
- **Supabase** - Real-time database and authentication integration
- **Framer Motion** - Smooth animations and micro-interactions

### Backend

- **Go 1.24+** - High-performance concurrent API server
- **PostgreSQL 14+** - Relational database with 11 core tables
- **sqlc** - Compile-time SQL query validation with type safety
- **Google Vertex AI Gemini 2.5 Flash** - AI-powered transcription and clinical analysis
- **JWT Authentication** - Secure token-based authorization
- **Gin Web Framework** - Fast HTTP request routing and middleware

### Infrastructure & Deployment

- **Docker** - Containerized backend and frontend deployment
- **CORS & Rate Limiting** - Security and scalability middleware

## ✨ Key Features

### Clinical Documentation

- **54+ Clinical Note Templates** - SOAP, H&P, specialty-specific templates across 10+ medical specialties
- **Template-Agnostic Architecture** - Semantic role-based extraction with dynamic section mapping
- **AI-Powered Analysis** - Google Vertex AI Gemini 2.5 Flash for clinical text processing

### Audio Processing

- **Real-time Transcription** - Automatic speech-to-text with speaker diarization
- **Chunked Upload** - Resume-able large file uploads with progress tracking
- **Multi-format Support** - WebM, MP3, WAV, OGG, FLAC, AMR audio formats

### Security & Authentication

- **JWT Token-Based Auth** - Secure token with configurable expiration
- **Role-Based Access Control** - Doctor, Nurse, Admin, Clinician roles
- **HIPAA-Ready** - Audit logging and secure password hashing with bcrypt
- **SQL Injection Prevention** - Type-safe queries with sqlc

### Data Management

- **PostgreSQL Database** - Multi-tenant ready with 11 core tables
- **Type-Safe Queries** - Compile-time query validation with sqlc
- **Comprehensive Patient Data** - Demographics, vitals, allergies, medications, history

## 🚀 Quick Start

### Prerequisites

- **Backend**: Go 1.24+, PostgreSQL 14+
- **Frontend**: Node.js 18+, npm/yarn

### Backend Setup

```bash
cd backend

# Install dependencies
go mod download

# Install sqlc
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

# Generate database code
sqlc generate

# Configure environment
cp .env.example .env
# Update .env with your settings

# Setup database
createdb medclara_scribe
psql medclara_scribe < db/schema.sql

# Run application
go run cmd/main.go
```

Server runs on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EOF

# Run development server
npm run dev
```

Frontend runs on `http://localhost:3000`

## 📡 API Overview

### Authentication

```bash
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Clinical Templates

```bash
GET /api/templates
GET /api/templates?specialty=cardiology
```

### Recording Management

```bash
POST /api/recordings/chunked/init        # Start upload
POST /api/recordings/chunked/upload      # Upload chunk
POST /api/recordings/chunked/finalize    # Process audio
GET  /api/recordings/{recordingId}       # Get results
GET  /api/recordings/{recordingId}/status
```

### Scribe Workspace

```bash
GET  /api/scribe-workspace               # Get workspace data
PATCH /api/scribe-workspace/note-sections/{key}
```

See [backend/openapi.yaml](backend/openapi.yaml) for complete API specification.

## 🗄️ Database Schema

### Core Tables

- `users` - User accounts with roles
- `organizations` - Multi-tenant organization data
- `patients` - Patient demographics and medical history
- `encounters` - Clinical encounters
- `templates` - 54+ clinical note template definitions
- `clinical_notes` - Patient clinical notes
- `recordings` - Audio recordings with AI analysis
- `transcript_segments` - Transcribed segments with speaker info
- `tasks` - Encounter tasks
- `orders` - Medical orders
- `diagnostic_results` - Lab and imaging results

## 🔐 Security

- **JWT Authentication** - HS256 signed tokens
- **Bcrypt Password Hashing** - 12-round hashing
- **Role-Based Access Control** - Doctor, Nurse, Admin, Clinician
- **SQL Injection Prevention** - sqlc type-safe queries
- **CORS Configuration** - Configurable allowed origins
- **Rate Limiting** - Endpoint protection middleware

## 📊 Development Workflow

### Backend Development

```bash
cd backend

# Run tests
go test ./...

# Build for production
go build -o medclara-server cmd/main.go

# After changing db schema
sqlc generate
```

### Frontend Development

```bash
cd frontend

# Development with hot reload
npm run dev

# Build for production
npm run build
npm run start

# Run linter
npm run lint
```

## 🔧 Configuration

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/medclara_scribe

# Security
JWT_SECRET=your-secret-key-min-32-chars

# GCP/Vertex AI
GCP_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Server
SERVER_ADDR=:8000
ENVIRONMENT=development
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📚 Documentation

**Backend:**

- [Backend README](backend/README.md) - Detailed backend documentation
- [OpenAPI Spec](backend/openapi.yaml) - Complete API specification
- [Architecture Analysis](backend/ARCHITECTURE_ANALYSIS.md) - System design

**Frontend:**

- [Frontend README](frontend/README.md) - Frontend setup and deployment
- [Type Definitions](frontend/types/scribe.ts) - TypeScript interfaces

## 🚨 Troubleshooting

### Database Connection Issues

```bash
# Verify PostgreSQL is running
psql -h localhost -U postgres -d medclara_scribe -c "SELECT 1;"

# Check connection string format
# Should be: postgresql://user:password@host:port/database
```

### JWT Secret Too Short

```bash
# Generate a strong secret
openssl rand -base64 32
# Update .env with the generated value
```

### Frontend API Connection Issues

- Verify backend is running on `http://localhost:8000`
- Check CORS origins in backend config
- Verify API endpoints in frontend proxy configuration

## 🐳 Docker Deployment

### Backend

```bash
cd backend
docker build -t medclara-backend .
docker run -p 8000:8000 --env-file .env medclara-backend
```

### Frontend

```bash
cd frontend
docker build -t medclara-frontend .
docker run -p 3000:3000 medclara-frontend
```

## 📞 Support

For issues or questions:

- Backend issues: See [backend/README.md](backend/README.md)
- Frontend issues: See [frontend/README.md](frontend/README.md)
- API specification: See [backend/openapi.yaml](backend/openapi.yaml)
