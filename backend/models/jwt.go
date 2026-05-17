package models

import (
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// GenerateToken generates a JWT token for a user
func GenerateToken(userID string, email string) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if os.Getenv("ENVIRONMENT") == "production" || os.Getenv("ENVIRONMENT") == "prod" {
			log.Fatal("FATAL: JWT_SECRET environment variable must be set in production. Generate a random key with: openssl rand -base64 32")
		}
		// Development fallback
		jwtSecret = "dev-secret-key-change-in-production-min-32-chars"
	}

	// Validate minimum length (best practice)
	if len(jwtSecret) < 32 {
		log.Printf("WARNING: JWT_SECRET is less than 32 characters. This is insecure. Please use a longer key.")
	}

	expirationTime := time.Now().Add(24 * time.Hour) // Token valid for 24 hours

	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// VerifyToken verifies a JWT token and returns claims
func VerifyToken(tokenString string) (*Claims, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		if os.Getenv("ENVIRONMENT") == "production" || os.Getenv("ENVIRONMENT") == "prod" {
			log.Fatal("FATAL: JWT_SECRET environment variable must be set in production")
		}
		// Development fallback
		jwtSecret = "dev-secret-key-change-in-production-min-32-chars"
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}

	return claims, nil
}
