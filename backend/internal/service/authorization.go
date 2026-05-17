package service

import (
	"fmt"

	"github.com/google/uuid"
)

// ValidateResourceOwnership checks if user has access to resource in their organization
// HIPAA compliance: Ensures users can only access data within their organization
func ValidateResourceOwnership(userOrgID, resourceOrgID uuid.UUID) error {
	if userOrgID != resourceOrgID {
		return fmt.Errorf("unauthorized: resource does not belong to user's organization")
	}
	return nil
}

// ValidateUserHasOrganization ensures user is assigned to an organization
func ValidateUserHasOrganization(orgID uuid.UUID) error {
	if orgID == uuid.Nil {
		return fmt.Errorf("user is not assigned to any organization")
	}
	return nil
}

// ValidateResourceExists checks if resource exists and belongs to user's org
func ValidateResourceExists(resourceOrgID, userOrgID uuid.UUID, resourceType string) error {
	if resourceOrgID == uuid.Nil {
		return fmt.Errorf("%s not found", resourceType)
	}

	if err := ValidateResourceOwnership(userOrgID, resourceOrgID); err != nil {
		// Return generic "not found" to prevent org ID enumeration
		return fmt.Errorf("%s not found", resourceType)
	}

	return nil
}
