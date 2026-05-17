package main

import (
	"bufio"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
}

type User struct {
	ID             uuid.UUID
	Email          string
	FirstName      string
	LastName       string
	Role           string
	OrganizationID *uuid.UUID
	IsActive       bool
	CreatedAt      string
	UpdatedAt      string
}

type Organization struct {
	ID          uuid.UUID
	Name        string
	Description sql.NullString
	CreatedAt   string
	UpdatedAt   string
}

func main() {
	command := flag.String("cmd", "", "Command: add-user, list-users, delete-user, reset-pwd, set-role, list-orgs, create-org")
	flag.Parse()

	if *command == "" {
		printMenu()
		choice := readInput("Select command by number or name")
		command = mapCommandInput(choice)
	}

	config := loadConfig()
	db := connectDB(config)
	defer db.Close()

	switch *command {
	case "add-user":
		addUser(db)
	case "list-users":
		listUsers(db)
	case "delete-user":
		deleteUser(db)
	case "reset-pwd":
		resetPassword(db)
	case "set-role":
		setRole(db)
	case "list-orgs":
		listOrganizations(db)
	case "create-org":
		createOrganization(db)
	default:
		fmt.Printf("❌ Unknown command: %s\n", *command)
		os.Exit(1)
	}
}

func mapCommandInput(input string) *string {
	commandMap := map[string]string{
		"1":           "add-user",
		"2":           "list-users",
		"3":           "delete-user",
		"4":           "reset-pwd",
		"5":           "set-role",
		"6":           "list-orgs",
		"7":           "create-org",
		"add-user":    "add-user",
		"list-users":  "list-users",
		"delete-user": "delete-user",
		"reset-pwd":   "reset-pwd",
		"set-role":    "set-role",
		"list-orgs":   "list-orgs",
		"create-org":  "create-org",
	}

	if cmd, exists := commandMap[strings.TrimSpace(input)]; exists {
		return &cmd
	}

	fmt.Printf("❌ Invalid selection: %s\n", input)
	os.Exit(1)
	return nil
}

func printMenu() {
	fmt.Println()
	fmt.Println("╔════════════════════════════════════════╗")
	fmt.Println("║   Medclara User Management Tool        ║")
	fmt.Println("╚════════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("📋 USERS")
	fmt.Println("  [1] Add new user")
	fmt.Println("  [2] List all users")
	fmt.Println("  [3] Delete user")
	fmt.Println("  [4] Reset password")
	fmt.Println("  [5] Set user role")
	fmt.Println()
	fmt.Println("🏢 ORGANIZATIONS")
	fmt.Println("  [6] List organizations")
	fmt.Println("  [7] Create organization")
	fmt.Println()
}

func loadConfig() Config {
	// Load .env file from project root
	godotenv.Load()

	return Config{
		DBHost:     getEnv("POSTGRES_HOST", "localhost"),
		DBPort:     getEnv("POSTGRES_PORT", "5432"),
		DBUser:     getEnv("POSTGRES_USER", "postgres"),
		DBPassword: getEnv("POSTGRES_PASSWORD", "postgres"),
		DBName:     getEnv("POSTGRES_DATABASE", "medclara"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func connectDB(config Config) *sql.DB {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		config.DBHost, config.DBPort, config.DBUser, config.DBPassword, config.DBName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	fmt.Println("✓ Database connection successful")
	return db
}

// ============================================================================
// USER FUNCTIONS
// ============================================================================

func addUser(db *sql.DB) {
	fmt.Println()
	fmt.Println("📝 Adding new user to Medclara")
	fmt.Println()

	email := readInput("Enter email address")
	firstName := readInput("Enter first name")
	lastName := readInput("Enter last name")
	role := readInputWithDefault("Enter role (doctor/admin/staff/patient)", "doctor")
	password := readPassword("Enter password (min 8 chars)")
	passwordConfirm := readPassword("Confirm password")

	if password != passwordConfirm {
		fmt.Println("❌ Passwords do not match")
		return
	}

	if len(password) < 8 {
		fmt.Println("❌ Password must be at least 8 characters")
		return
	}

	// Hash password using bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("❌ Failed to hash password: %v\n", err)
		return
	}

	org := selectOrganization(db)

	userID := uuid.New()

	var result sql.Result
	if org != nil {
		result, err = db.Exec(
			"INSERT INTO users (id, email, first_name, last_name, role, password, organization_id, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())",
			userID, email, firstName, lastName, role, string(hashedPassword), org,
		)
	} else {
		result, err = db.Exec(
			"INSERT INTO users (id, email, first_name, last_name, role, password, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())",
			userID, email, firstName, lastName, role, string(hashedPassword),
		)
	}

	if err != nil {
		fmt.Printf("❌ Failed to create user: %v\n", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Println()
		fmt.Println("✓ User created successfully")
		fmt.Println()
		fmt.Println("User Details:")
		fmt.Printf("  ID:    %s\n", userID)
		fmt.Printf("  Email: %s\n", email)
		fmt.Printf("  Name:  %s %s\n", firstName, lastName)
		fmt.Printf("  Role:  %s\n", role)
		if org != nil {
			fmt.Printf("  Org:   %s\n", org)
		}
		fmt.Println()
		fmt.Println("✓ Password has been securely hashed (bcrypt)")
		fmt.Println("✓ User can now login with their credentials")
	}
}

func listUsers(db *sql.DB) {
	fmt.Println()
	fmt.Println("📋 Listing all users")
	fmt.Println()

	rows, err := db.Query(`
		SELECT 
			id, 
			email, 
			first_name, 
			last_name, 
			role, 
			COALESCE(organization_id::text, 'No Organization') as organization,
			is_active,
			created_at,
			updated_at
		FROM users
		ORDER BY created_at DESC
	`)
	if err != nil {
		fmt.Printf("❌ Failed to fetch users: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Println("ID                                   | Email                    | Name                     | Role     | Organization")
	fmt.Println("──────────────────────────────────────┼──────────────────────────┼──────────────────────────┼──────────┼────────────────")

	count := 0
	for rows.Next() {
		var id, email, firstName, lastName, role, org, active, createdAt, updatedAt string
		if err := rows.Scan(&id, &email, &firstName, &lastName, &role, &org, &active, &createdAt, &updatedAt); err != nil {
			fmt.Printf("Error scanning row: %v\n", err)
			continue
		}

		fullName := fmt.Sprintf("%s %s", firstName, lastName)
		fmt.Printf("%-36s | %-24s | %-24s | %-8s | %s\n", id[:8]+"...", email, fullName, role, org[:16])
		count++
	}

	if count == 0 {
		fmt.Println("No users found")
	}

	fmt.Println()
}

func deleteUser(db *sql.DB) {
	fmt.Println()
	fmt.Println("🗑️  Delete user from Medclara")
	fmt.Println()

	identifier := readInput("Enter user email or ID")

	var userID string
	var email string
	var firstName string
	var lastName string

	err := db.QueryRow(
		"SELECT id, email, first_name, last_name FROM users WHERE email = $1 OR id::text = $1 LIMIT 1",
		identifier,
	).Scan(&userID, &email, &firstName, &lastName)

	if err == sql.ErrNoRows {
		fmt.Printf("❌ User not found: %s\n", identifier)
		return
	}
	if err != nil {
		fmt.Printf("❌ Failed to fetch user: %v\n", err)
		return
	}

	fmt.Println()
	fmt.Printf("User to delete: %s %s (%s)\n", firstName, lastName, email)
	fmt.Println()
	confirm := readInput("Type 'yes' to confirm deletion")

	if confirm != "yes" {
		fmt.Println("⚠️  Deletion cancelled")
		return
	}

	result, err := db.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		fmt.Printf("❌ Failed to delete user: %v\n", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Println("✓ User deleted successfully")
	}
}

func resetPassword(db *sql.DB) {
	fmt.Println()
	fmt.Println("🔐 Reset user password")
	fmt.Println()

	identifier := readInput("Enter user email or ID")

	var userID string
	var email string
	err := db.QueryRow(
		"SELECT id, email FROM users WHERE email = $1 OR id::text = $1 LIMIT 1",
		identifier,
	).Scan(&userID, &email)

	if err == sql.ErrNoRows {
		fmt.Printf("❌ User not found: %s\n", identifier)
		return
	}
	if err != nil {
		fmt.Printf("❌ Failed to fetch user: %v\n", err)
		return
	}

	fmt.Printf("Resetting password for: %s\n", email)
	fmt.Println()

	password := readPassword("Enter new password (min 8 chars)")
	passwordConfirm := readPassword("Confirm password")

	if password != passwordConfirm {
		fmt.Println("❌ Passwords do not match")
		return
	}

	if len(password) < 8 {
		fmt.Println("❌ Password must be at least 8 characters")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("❌ Failed to hash password: %v\n", err)
		return
	}

	_, err = db.Exec("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", string(hashedPassword), userID)
	if err != nil {
		fmt.Printf("❌ Failed to update password: %v\n", err)
		return
	}

	fmt.Println("✓ Password reset successfully")
}

func setRole(db *sql.DB) {
	fmt.Println()
	fmt.Println("👤 Set user role")
	fmt.Println()

	identifier := readInput("Enter user email or ID")

	var userID string
	var email string
	var currentRole string
	err := db.QueryRow(
		"SELECT id, email, role FROM users WHERE email = $1 OR id::text = $1 LIMIT 1",
		identifier,
	).Scan(&userID, &email, &currentRole)

	if err == sql.ErrNoRows {
		fmt.Printf("❌ User not found: %s\n", identifier)
		return
	}
	if err != nil {
		fmt.Printf("❌ Failed to fetch user: %v\n", err)
		return
	}

	fmt.Printf("Current role: %s\n", currentRole)
	fmt.Println()
	fmt.Println("🔤 Available roles:")
	fmt.Println("  [1] doctor")
	fmt.Println("  [2] admin")
	fmt.Println("  [3] staff")
	fmt.Println("  [4] patient")
	fmt.Println()

	choice := readInput("Select new role (1-4)")

	var newRole string
	switch choice {
	case "1":
		newRole = "doctor"
	case "2":
		newRole = "admin"
	case "3":
		newRole = "staff"
	case "4":
		newRole = "patient"
	default:
		fmt.Println("❌ Invalid choice")
		return
	}

	_, err = db.Exec("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", newRole, userID)
	if err != nil {
		fmt.Printf("❌ Failed to update role: %v\n", err)
		return
	}

	fmt.Printf("✓ User role updated to: %s\n", newRole)
}

// ============================================================================
// ORGANIZATION FUNCTIONS
// ============================================================================

func listOrganizations(db *sql.DB) {
	fmt.Println()
	fmt.Println("🏢 Listing all organizations")
	fmt.Println()

	rows, err := db.Query(`
		SELECT id, name, description, created_at, updated_at
		FROM organizations
		ORDER BY created_at DESC
	`)
	if err != nil {
		fmt.Printf("❌ Failed to fetch organizations: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Println("ID                                   | Name                                 | Description")
	fmt.Println("──────────────────────────────────────┼──────────────────────────────────────┼────────────────")

	count := 0
	for rows.Next() {
		var id, name, description, createdAt, updatedAt string
		if err := rows.Scan(&id, &name, &description, &createdAt, &updatedAt); err != nil {
			fmt.Printf("Error scanning row: %v\n", err)
			continue
		}

		desc := description
		if len(desc) > 30 {
			desc = desc[:27] + "..."
		}
		fmt.Printf("%-36s | %-36s | %s\n", id[:8]+"...", name, desc)
		count++
	}

	if count == 0 {
		fmt.Println("No organizations found")
	}

	fmt.Println()
}

func createOrganization(db *sql.DB) {
	fmt.Println()
	fmt.Println("➕ Creating new organization")
	fmt.Println()

	name := readInput("Enter organization name")
	description := readInput("Enter organization description (optional)")

	orgID := uuid.New()

	var result sql.Result
	var err error

	if description != "" {
		result, err = db.Exec(
			"INSERT INTO organizations (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
			orgID, name, description,
		)
	} else {
		result, err = db.Exec(
			"INSERT INTO organizations (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())",
			orgID, name,
		)
	}

	if err != nil {
		fmt.Printf("❌ Failed to create organization: %v\n", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Println()
		fmt.Println("✓ Organization created successfully")
		fmt.Println()
		fmt.Println("Organization Details:")
		fmt.Printf("  ID:   %s\n", orgID)
		fmt.Printf("  Name: %s\n", name)
		if description != "" {
			fmt.Printf("  Desc: %s\n", description)
		}
		fmt.Println()
	}
}

func selectOrganization(db *sql.DB) *uuid.UUID {
	rows, err := db.Query("SELECT id, name FROM organizations ORDER BY created_at DESC")
	if err != nil {
		fmt.Printf("❌ Failed to fetch organizations: %v\n", err)
		return nil
	}
	defer rows.Close()

	var orgs []Organization
	for rows.Next() {
		var org Organization
		if err := rows.Scan(&org.ID, &org.Name); err != nil {
			continue
		}
		orgs = append(orgs, org)
	}

	if len(orgs) == 0 {
		fmt.Println("⚠️  No organizations found")
		fmt.Println()
		choice := readInput("Create new organization? (yes/no)")
		if choice == "yes" {
			createOrganization(db)
			return selectOrganization(db)
		}
		return nil
	}

	fmt.Println()
	fmt.Println("🏢 Select organization (or skip):")
	fmt.Println()
	for i, org := range orgs {
		fmt.Printf("  [%d] %s\n", i+1, org.Name)
	}
	fmt.Printf("  [%d] Create new organization\n", len(orgs)+1)
	fmt.Printf("  [0] Skip (no organization)\n")
	fmt.Println()

	choice := readInput(fmt.Sprintf("Select (0-%d)", len(orgs)+1))
	choiceNum := 0
	fmt.Sscanf(choice, "%d", &choiceNum)

	if choiceNum == 0 {
		return nil
	}

	if choiceNum > 0 && choiceNum <= len(orgs) {
		return &orgs[choiceNum-1].ID
	}

	if choiceNum == len(orgs)+1 {
		createOrganization(db)
		return selectOrganization(db)
	}

	fmt.Println("❌ Invalid choice")
	return selectOrganization(db)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func readInput(prompt string) string {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s: ", prompt)
	text, _ := reader.ReadString('\n')
	return strings.TrimSpace(text)
}

func readInputWithDefault(prompt, defaultValue string) string {
	result := readInput(fmt.Sprintf("%s [%s]", prompt, defaultValue))
	if result == "" {
		return defaultValue
	}
	return result
}

func readPassword(prompt string) string {
	fmt.Printf("%s: ", prompt)
	password, _ := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	return string(password)
}
