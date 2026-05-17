# Medclara Backend - SOLID Refactoring Guide

## Overview

This document describes the SOLID principles refactoring applied to the Medclara backend codebase. The refactoring introduces a cleaner architecture while maintaining backward compatibility with the existing codebase.

## New Package Structure

```
internal/
├── interfaces/       # Service contracts (DIP, ISP)
│   └── services.go   # All interface definitions
├── container/        # Dependency injection container
│   └── container.go  # Composition root
├── errors/           # Standardized error types (SRP)
│   └── errors.go     # ServiceError, ValidationError, etc.
├── factory/          # Service factory pattern
│   └── services.go   # Factory for creating services
├── handler/          # Base handler utilities
│   └── base.go       # Common handler operations
├── response/         # Response utilities (SRP)
│   └── response.go   # Standardized API responses
└── routes/           # Modular route registration (SRP)
    ├── registrar.go  # Route registration interface
    ├── auth.go       # Authentication routes
    ├── patients.go   # Patient routes
    ├── templates.go  # Template routes
    ├── sessions.go   # Session routes
    ├── notes.go      # Notes routes
    ├── recordings.go # Recording routes
    └── misc.go       # Utility routes
```

## SOLID Principles Applied

### 1. Single Responsibility Principle (SRP)

**Before:**
- `cmd/main.go` handled configuration, database, services, routing, and server setup all in one file
- Controllers mixed HTTP handling with response formatting

**After:**
- **`internal/errors/errors.go`**: Handles only error types and HTTP mapping
- **`internal/response/response.go`**: Handles only response formatting
- **`internal/routes/*.go`**: Each file handles only related routes
- **`internal/container/container.go`**: Handles only dependency wiring

### 2. Open/Closed Principle (OCP)

**Before:**
- Adding new services required modifying main.go and multiple controllers

**After:**
- **Factory Pattern**: `internal/factory/services.go` - extend by adding new factory methods
- **Route Registration**: Add new `RouteRegistrar` implementations without modifying existing code
- **Error Types**: Extend `ErrorType` enum for new error categories

### 3. Liskov Substitution Principle (LSP)

**Before:**
- Services had no common contracts

**After:**
- **Interface Contracts**: All services implement interfaces from `internal/interfaces/services.go`
- Any service implementation can be substituted as long as it satisfies the interface
- Enables easy mocking for tests

### 4. Interface Segregation Principle (ISP)

**Before:**
- Large service types with many methods

**After:**
- **Segregated Interfaces**:
  ```go
  // Small, focused interfaces
  type NoteReader interface {
      GetNote(ctx context.Context, noteID string, organizationID uuid.UUID) (*models.Note, error)
      GetNotesByPatient(...) ([]models.Note, int, error)
      // ... only read operations
  }

  type NoteWriter interface {
      CreateNote(...) (*models.Note, error)
      UpdateNote(...) (*models.Note, error)
      // ... only write operations
  }

  // Combined interface for full access
  type NotesService interface {
      NoteReader
      NoteWriter
  }
  ```

### 5. Dependency Inversion Principle (DIP)

**Before:**
- Controllers created services directly
- Hard dependencies on concrete implementations

**After:**
- **Container Pattern**: `internal/container/container.go`
  ```go
  // Depend on abstractions, not concretions
  type Container struct {
      notesService     interfaces.NotesService     // Interface, not concrete
      recordingService interfaces.RecordingService // Interface, not concrete
  }
  ```
- Controllers receive dependencies through interfaces
- Easy to swap implementations for testing

## Design Patterns Implemented

### 1. Dependency Injection Container

**File:** `internal/container/container.go`

```go
// Create container with all dependencies
container, err := container.New(cfg, dbConn, nil)

// Get services via interfaces
notesService := container.NotesService()      // Returns interfaces.NotesService
recordingService := container.RecordingService() // Returns interfaces.RecordingService
```

### 2. Factory Pattern

**File:** `internal/factory/services.go`

```go
factory := NewServiceFactory(dbConn, cfg)

// Create individual services
notesService := factory.CreateNotesService()
aiService := factory.CreateAIService()

// Or create all services at once
allServices := factory.CreateAllServices("./uploads/chunked", true)
```

### 3. Strategy Pattern (for Route Registration)

**File:** `internal/routes/registrar.go`

```go
// Each route module implements RouteRegistrar
type RouteRegistrar interface {
    Register(router *gin.RouterGroup, container *container.Container)
}

// Register routes with different strategies
authRoutes := &AuthRoutes{}
authRoutes.Register(api.Group("/auth"), container)

patientRoutes := &PatientRoutes{}
patientRoutes.Register(protected.Group("/patients"), container)
```

### 4. Result Object Pattern (for Errors)

**File:** `internal/errors/errors.go`

```go
// Typed errors with HTTP status mapping
err := errors.NewNotFoundError("patient", patientID)
err := errors.NewValidationError("email", "invalid format")
err := errors.NewAuthorizationError("access denied")

// Automatic HTTP status resolution
status := errors.HTTPStatus(err) // Returns 404, 400, 403, etc.
```

## Migration Guide

### Option 1: Gradual Migration (Recommended)

The new packages work alongside existing code. Migrate incrementally:

1. **Start using errors package:**
   ```go
   // Old
   return fmt.Errorf("patient not found")
   
   // New
   return errors.NewNotFoundError("patient", patientID)
   ```

2. **Use container in new handlers:**
   ```go
   // Old
   func NewHandler(dbConn *sql.DB) gin.HandlerFunc {
       service := service.NewNotesService(db.New(dbConn), dbConn)
       // ...
   }
   
   // New
   func NewHandler(c *container.Container) gin.HandlerFunc {
       service := c.NotesService()
       // ...
   }
   ```

3. **Migrate routes to modular structure:**
   ```go
   // Use RouteRegistrar implementations
   routes.NewAuthRoutes().Register(authGroup, container)
   ```

### Option 2: Full Refactor (main.go)

Replace the main.go initialization with container:

```go
func main() {
    cfg, _ := config.Load()
    dbConn, _ := db.GetConnection(cfg)
    
    // Use container instead of manual service creation
    container, _ := container.New(cfg, dbConn, nil)
    defer container.Shutdown()
    
    // Start background services
    container.StartBackgroundServices()
    
    // ... rest of setup
}
```

## Testing Benefits

### Mock Services

```go
// Create mock implementation
type MockNotesService struct {
    mock.Mock
}

func (m *MockNotesService) GetNote(ctx context.Context, noteID string, orgID uuid.UUID) (*models.Note, error) {
    args := m.Called(ctx, noteID, orgID)
    return args.Get(0).(*models.Note), args.Error(1)
}

// Use in tests
func TestHandler(t *testing.T) {
    mockNotes := new(MockNotesService)
    mockNotes.On("GetNote", mock.Anything, "note-123", mock.Anything).Return(&models.Note{...}, nil)
    
    // Inject mock into handler
    handler := NewGetNoteHandler(mockNotes)
    // ... test
}
```

### Test Factory

```go
func TestNotesService(t *testing.T) {
    // Use test database
    testDB := setupTestDB(t)
    
    factory := factory.NewTestServiceFactory(testDB)
    notesService := factory.CreateNotesService()
    
    // Test with real service but test database
    note, err := notesService.CreateNote(ctx, ...)
}
```

## File Reference

| File | Purpose | Key Types |
|------|---------|-----------|
| `internal/interfaces/services.go` | Interface definitions | `NotesService`, `RecordingService`, `AIService`, etc. |
| `internal/container/container.go` | DI container | `Container`, `ContainerOptions` |
| `internal/errors/errors.go` | Error types | `ServiceError`, `ValidationError`, `ErrorType` |
| `internal/response/response.go` | Response utilities | `APIResponse`, `Success()`, `Error()` |
| `internal/handler/base.go` | Handler utilities | `BaseHandler`, `GetUserID()`, `HandleError()` |
| `internal/factory/services.go` | Service factory | `ServiceFactory`, `AllServices` |
| `internal/routes/*.go` | Route modules | `RouteRegistrar`, `AuthRoutes`, etc. |

## Backward Compatibility

All changes are **additive** - the existing code continues to work:

- ✅ Existing `cmd/main.go` unchanged (still works)
- ✅ Existing controllers unchanged (still work)
- ✅ Existing services unchanged (still work)
- ✅ New packages can be adopted incrementally
- ✅ Tests continue to pass

## Next Steps

1. **Optional**: Update `cmd/main.go` to use container pattern
2. **Optional**: Migrate controllers to use `BaseHandler` for common operations
3. **Optional**: Add unit tests using mock implementations
4. **Optional**: Migrate route registration to use `RouteRegistrar`

The refactoring provides the foundation - you can adopt these patterns at your own pace.
