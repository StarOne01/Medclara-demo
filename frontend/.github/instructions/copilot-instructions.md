# Copilot Instructions for Medclara Web

This document provides AI agents with essential context and patterns for working on the Medclara Web codebase.

## Project Overview

**Medclara Web** is a Next.js 16 + React 19 clinical documentation platform with:
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: REST API with session-based architecture
- **Database**: Supabase with Row-Level Security (RLS)
- **Key Feature**: Medical scribe workspace for recording, transcribing, and documenting patient encounters

## Architecture Patterns

### 1. Unified API Client Pattern

**File**: `lib/api-client-unified.ts` (1125 lines)

The API client is the **single source of truth** for all backend communication. It:
- Organizes endpoints by resource (auth, patients, templates, sessions, notes, recordings)
- **Automatically converts snake_case responses to camelCase** via `snakeToCamelCase()`
- Handles authentication via JWT tokens stored in localStorage
- Implements error handling with custom `ApiError` class

**Critical Pattern**: Always use `getApiClient()` singleton instead of making raw fetch calls:

```typescript
import { getApiClient } from "@/lib/api-client-unified";
const client = getApiClient();
const session = await client.sessions.get(sessionId);
```

### 2. Session-Note Relationship (Critical Understanding)

**This pattern caused a major bug—understand it well:**

**WRONG Assumption**: Notes are stored IN the session object
**CORRECT Architecture**: Notes are **LINKED to sessions via `scribe_page_id` field**

- **Session endpoint** (`GET /api/sessions/{sessionId}`):
  - Returns session with `noteSections` field (Record<string, string>)
  - Backend automatically fetches linked notes and populates `noteSections`
  - If `noteSections` is empty, notes should be loaded via fallback

- **Notes endpoint** (`GET /api/notes/session/{scribeSessionId}`):
  - Returns array of notes where `scribe_page_id` matches session ID
  - Note content is stored as **JSON** (primary format)
  - Each note has a `content` field with JSON structure like: `{ "chief_complaint": "...", "assessment": "..." }`

**Why This Matters**: When accessing previous sessions, `noteSections` might be empty on first load. The frontend implements a **fallback mechanism** to fetch from the notes endpoint.

### 3. Note Content Format Handling

Notes can be in two formats—backend returns **JSON**, frontend must handle both:

```typescript
// Try JSON parsing first (backend primary format)
try {
  const parsed = JSON.parse(noteContent);
  if (typeof parsed === 'object') {
    Object.assign(sections, parsed);
  }
} catch {
  // Fallback: Parse markdown-style headers for legacy data
  const headerRegex = /^## (.+)/gm;
  let match;
  while ((match = headerRegex.exec(noteContent)) !== null) {
    const key = match[1].toLowerCase().replace(/\s+/g, '_');
    sections[key] = noteContent.substring(match.index + match[0].length, /* ... */).trim();
  }
}
```

**Key Point**: Always try JSON first, markdown second. Backend clarified content is stored as JSON.

### 4. Template Selection Pattern

**When loading a previous session**, ALWAYS use the session's original `templateId`, NOT the first available template:

```typescript
// WRONG ❌
const firstTemplate = templates[0];
setSelectedTemplateId(firstTemplate.id);

// CORRECT ✅
const session = await client.sessions.get(sessionId);
setSelectedTemplateId(session.templateId); // Use original template from session
```

**Why**: Different templates have different sections. Using the wrong template causes sections to not render.

## Critical Files & Components

### `components/scribe-page.tsx` (3701 lines)
Main clinical workspace component:
- **`loadWorkspace` effect (lines 1557-1693)**: Loads session, fetches notes with fallback
- **Note loading logic (lines 1587-1640)**: Two-phase fetch: session first, fallback to notes endpoint
- **Rendering logic (lines 2146-2157)**: Renders sections using template structure, falls back to `noteSections` keys
- **Key State**: `workspaceData` is the source of truth for note sections

**Common Issue**: When `noteSections` empty on initial load → use fallback fetch → parse JSON/markdown → populate state

### `lib/api-client-unified.ts` (1125 lines)
API client organization:
- **Templates**: List, get, search by specialty
- **Sessions**: Create, list, get (with note population), bind patient, update sections
- **Notes**: List by patient, get by session, sign, create
- **Recordings**: Upload, chunked upload, transcribe
- **Auth**: Login, logout, current user

**Key Endpoints**:
```
POST /api/sessions                              → Create new session
GET /api/sessions/{sessionId}                   → Get session with noteSections
GET /api/notes/session/{sessionId}              → Get notes linked to session (fallback)
PATCH /api/sessions/{sessionId}/note-sections/{key}  → Update note section
```

### `app/scribe/[sessionId]/page.tsx`
Dynamic route that captures session ID from URL and passes to `ScribePage` component:
```typescript
export default function Page({ params }: { params: { sessionId: string } }) {
  return <ScribePage sessionIdFromUrl={params.sessionId} />;
}
```

### `types/scribe-api.ts`
Type definitions for all API responses. Key types:
- `Session`: Contains `sessionId`, `templateId`, `noteSections`, `patientId`, etc.
- `Note`: Contains `id`, `scribe_page_id`, `content`, `status`, etc.
- `GetSessionDataResponse`: Extended session response with nested objects

## Common Debugging Checklist

When notes don't appear when accessing previous sessions:

1. **Verify session loads**: Check if `await client.sessions.get(sessionId)` returns a valid session
2. **Check noteSections**: Is `response.noteSections` populated? If empty, fallback should trigger
3. **Verify fallback fetch**: Does `await client.notes.getByScribeSession(sessionId)` return notes?
4. **Check note content**: Is note content valid JSON or markdown? Log the raw content
5. **Verify template**: Is `session.templateId` being used, not a different template?
6. **Check template sections**: Does selected template have definitions for keys in noteSections?

**Key Log Points**:
```typescript
console.log('[loadWorkspace] Session data:', session);
console.log('[loadWorkspace] noteSections from session:', session.noteSections);
console.log('[loadWorkspace] Notes from fallback:', notes);
console.log('[parseNoteContent] Parsed sections:', sections);
console.log('[renderNoteSection] Available template sections:', template?.sections);
```

## Naming Conventions

- **API responses**: Use `snakeToCamelCase()` automatically (handled by client)
- **State variables**: camelCase (e.g., `selectedTemplateId`, `workspaceData`, `noteSections`)
- **Database fields**: snake_case in TypeScript interfaces (e.g., `scribe_page_id`, `created_at`)
- **URL parameters**: Snake case for backend, automatically converted

## Authentication & Headers

All API requests automatically include:
```typescript
{
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
}
```

Token is read from `localStorage.getItem('token')` by `apiFetch()` helper.

## Testing Commands

```bash
npm run dev              # Start dev server with turbopack
npm run build            # Production build
npm run start            # Run production build
npm run lint             # Run linting
npm run type-check       # Run TypeScript checks
```

## Key Lessons from Previous Fixes

1. **Don't assume data structure**: When a bug involves missing data, verify:
   - Is data returned by API? Check backend logs
   - Is data in the expected location? Data may be linked separately
   - Is data being parsed correctly? Try multiple format handlers

2. **Always implement fallbacks**: For data that may not be immediately available:
   - Try primary endpoint first
   - Fetch from alternative endpoint if empty
   - Parse multiple formats if content is ambiguous

3. **Template ID is critical**: Session's original template determines section structure. Using wrong template breaks UI.

4. **Backend communication**: When unclear, ask backend:
   - What format is stored (JSON, markdown, plain text)?
   - How is data linked (via foreign key, nested, separate endpoint)?
   - What does this endpoint return (raw, transformed, populated)?

## Useful Utility Files

- `lib/fallback-data.ts`: Fallback template UUIDs if API unavailable
- `lib/note-templates.ts`: Template definitions and section configurations
- `lib/http-interceptor.ts`: HTTP request/response logging
- `lib/content-cache.ts`: Client-side caching of content
- `lib/hooks/useScribeSession.tsx`: Hook for managing session initialization

## Next.js & React Patterns

- **Server Components**: Use for data fetching where possible (in layout.tsx, page.tsx)
- **Client Components**: Use for interactive components (scribe-page.tsx, forms)
- **useEffect in Scribe**: The `loadWorkspace` effect is critical—carefully handle dependencies
- **Framer Motion**: Used for animations in modals and transitions

## Environment Variables

```
NEXT_PUBLIC_API_URL          # Backend API base URL (default: http://localhost:8000)
NEXT_PUBLIC_SUPABASE_URL     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anonymous key
```

---

**Last Updated**: After comprehensive session-note loading investigation
**Most Recent Fix**: Implemented fallback note fetching with JSON→markdown parsing for accessing previous sessions
