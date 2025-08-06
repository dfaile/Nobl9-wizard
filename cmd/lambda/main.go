package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
	"github.com/nobl9/nobl9-go/manifest"
	v1alphaProject "github.com/nobl9/nobl9-go/manifest/v1alpha/project"
	v1alphaRoleBinding "github.com/nobl9/nobl9-go/manifest/v1alpha/rolebinding"
	"github.com/nobl9/nobl9-go/sdk"
)

// Valid roles that can be assigned
var validRoles = map[string]bool{
	"project-owner":  true,
	"project-viewer": true,
	"project-editor": true,
}

// UserGroup represents a group of users and their role
type UserGroup struct {
	UserIDs string `json:"userIds"` // Comma-separated list of user IDs or emails
	Role    string `json:"role"`    // Role to assign (must be one of validRoles)
}

// CreateProjectRequest defines the request payload for creating a project
type CreateProjectRequest struct {
	AppID       string      `json:"appID"`       // Name of the project to create
	Description string      `json:"description"` // Description of the project (optional)
	UserGroups  []UserGroup `json:"userGroups"`  // List of user groups with their roles
}

// Response defines the API response structure sent back to the client
type Response struct {
	Success bool   `json:"success"` // Whether the operation was successful
	Message string `json:"message"` // Human-readable message about the operation
}

// HealthResponse defines the health check response structure
type HealthResponse struct {
	Status      string `json:"status"`
	Timestamp   string `json:"timestamp"`
	Version     string `json:"version"`
	Environment string `json:"environment"`
}

// Nobl9Credentials holds the decrypted credentials
type Nobl9Credentials struct {
	ClientID     string
	ClientSecret string
}

// Global variables for AWS services
var (
	kmsClient  *kms.Client
	ssmClient  *ssm.Client
	appVersion = "1.0.0"
)

// ptr creates a pointer to a string - helper function needed for role binding specs
func ptr(s string) *string {
	return &s
}

// sanitizeName ensures the string is RFC-1123 compliant by converting to lowercase,
// replacing non-alphanumeric (except hyphen) characters with hyphens,
// and trimming leading/trailing hyphens.
func sanitizeName(name string) string {
	// Convert to lowercase
	name = strings.ToLower(name)
	// Replace non-alphanumeric characters (except hyphen) with a hyphen
	reg := regexp.MustCompile("[^a-z0-9-]+")
	name = reg.ReplaceAllString(name, "-")
	// Trim hyphens from the start and end
	name = strings.Trim(name, "-")
	return name
}

// truncate shortens a string to a max length, preserving uniqueness where possible.
func truncate(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}

// looksLikeEmail determines if a string appears to be intended as an email address
// even if it's malformed (e.g., missing @ symbol)
func looksLikeEmail(s string) bool {
	// If it contains @, it's definitely intended to be an email
	if strings.Contains(s, "@") {
		return true
	}

	// Check for common email domain patterns
	commonDomains := []string{".com", ".org", ".net", ".edu", ".gov", ".co.", ".io", ".dev"}
	for _, domain := range commonDomains {
		if strings.Contains(s, domain) {
			return true
		}
	}

	return false
}

// validateEmail performs basic email validation
func validateEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// validateProjectName validates the project name format
func validateProjectName(name string) error {
	if name == "" {
		return fmt.Errorf("project name cannot be empty")
	}

	if len(name) < 3 {
		return fmt.Errorf("project name must be at least 3 characters long")
	}

	if len(name) > 63 {
		return fmt.Errorf("project name must be less than 63 characters")
	}

	// Check for valid characters (lowercase letters, numbers, hyphens)
	validNameRegex := regexp.MustCompile(`^[a-z0-9-]+$`)
	if !validNameRegex.MatchString(name) {
		return fmt.Errorf("project name can only contain lowercase letters, numbers, and hyphens")
	}

	// Check that it doesn't start or end with hyphen
	if strings.HasPrefix(name, "-") || strings.HasSuffix(name, "-") {
		return fmt.Errorf("project name cannot start or end with a hyphen")
	}

	return nil
}

// getValidRoles returns a formatted string of valid roles for error messages
func getValidRoles() string {
	roles := make([]string, 0, len(validRoles))
	for role := range validRoles {
		roles = append(roles, role)
	}
	return strings.Join(roles, ", ")
}

// configureTLS sets up custom HTTP transport with TLS verification disabled if needed
func configureTLS() {
	if os.Getenv("NOBL9_SKIP_TLS_VERIFY") == "true" {
		log.Println("WARNING: SSL certificate verification is DISABLED (NOBL9_SKIP_TLS_VERIFY=true)")

		// Create a custom transport with TLS verification disabled
		customTransport := &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			// Copy other important settings from the default transport
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           (&net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}

		// Set this as the default transport for all HTTP clients
		http.DefaultTransport = customTransport
	} else {
		log.Println("TLS verification is enabled")
	}
}

// getNobl9Credentials retrieves and decrypts Nobl9 credentials from AWS Parameter Store and KMS
func getNobl9Credentials(ctx context.Context) (*Nobl9Credentials, error) {
	// Get parameter names from environment variables
	clientIDParamName := os.Getenv("NOBL9_CLIENT_ID_PARAM_NAME")
	clientSecretParamName := os.Getenv("NOBL9_CLIENT_SECRET_PARAM_NAME")

	if clientIDParamName == "" || clientSecretParamName == "" {
		return nil, fmt.Errorf("missing parameter names: NOBL9_CLIENT_ID_PARAM_NAME and NOBL9_CLIENT_SECRET_PARAM_NAME must be set")
	}

	log.Printf("Retrieving credentials from Parameter Store: %s, %s", clientIDParamName, clientSecretParamName)

	// Get encrypted credentials from Parameter Store
	clientIDParam, err := ssmClient.GetParameter(ctx, &ssm.GetParameterInput{
		Name:           aws.String(clientIDParamName),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get client ID parameter: %w", err)
	}

	clientSecretParam, err := ssmClient.GetParameter(ctx, &ssm.GetParameterInput{
		Name:           aws.String(clientSecretParamName),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get client secret parameter: %w", err)
	}

	// If parameters are encrypted with KMS, decrypt them
	clientID := *clientIDParam.Parameter.Value
	clientSecret := *clientSecretParam.Parameter.Value

	// Check if the values are KMS-encrypted (they start with "AQICAH")
	if strings.HasPrefix(clientID, "AQICAH") {
		log.Println("Decrypting client ID with KMS")
		clientIDBytes, err := kmsClient.Decrypt(ctx, &kms.DecryptInput{
			CiphertextBlob: []byte(clientID),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt client ID: %w", err)
		}
		clientID = string(clientIDBytes.Plaintext)
	}

	if strings.HasPrefix(clientSecret, "AQICAH") {
		log.Println("Decrypting client secret with KMS")
		clientSecretBytes, err := kmsClient.Decrypt(ctx, &kms.DecryptInput{
			CiphertextBlob: []byte(clientSecret),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt client secret: %w", err)
		}
		clientSecret = string(clientSecretBytes.Plaintext)
	}

	log.Println("Successfully retrieved Nobl9 credentials")
	return &Nobl9Credentials{
		ClientID:     clientID,
		ClientSecret: clientSecret,
	}, nil
}

// handleHealthCheck handles health check requests
func handleHealthCheck(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Only allow GET requests
	if request.HTTPMethod != "GET" {
		return respondLambdaWithStatus(http.StatusMethodNotAllowed, false, "Method not allowed")
	}

	healthResponse := HealthResponse{
		Status:      "healthy",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Version:     appVersion,
		Environment: os.Getenv("ENVIRONMENT"),
	}

	responseBody, err := json.Marshal(healthResponse)
	if err != nil {
		log.Printf("Error marshaling health response: %v", err)
		return respondLambdaWithStatus(http.StatusInternalServerError, false, "Internal server error")
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(responseBody),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	}, nil
}

// handleCreateProject processes Lambda requests to create a new project and assign user roles
func handleCreateProject(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Only allow POST requests
	if request.HTTPMethod != "POST" {
		return respondLambdaWithStatus(http.StatusMethodNotAllowed, false, "Method not allowed")
	}

	log.Printf("Processing create project request: %s", request.Body)

	// Parse the JSON request body into our struct
	var req CreateProjectRequest
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return respondLambdaWithStatus(http.StatusBadRequest, false, "Invalid request body: "+err.Error())
	}

	// Validate the project name
	if err := validateProjectName(req.AppID); err != nil {
		log.Printf("Invalid project name '%s': %v", req.AppID, err)
		return respondLambdaWithStatus(http.StatusBadRequest, false, err.Error())
	}

	if len(req.UserGroups) == 0 {
		log.Printf("No user groups provided for project '%s'", req.AppID)
		return respondLambdaWithStatus(http.StatusBadRequest, false, "At least one user group is required")
	}

	// Validate all roles and user identifiers in the request
	for groupIndex, group := range req.UserGroups {
		if !validRoles[group.Role] {
			log.Printf("Invalid role '%s' in group %d", group.Role, groupIndex)
			return respondLambdaWithStatus(http.StatusBadRequest, false, fmt.Sprintf("Invalid role '%s' in group %d. Must be one of: %s", group.Role, groupIndex, getValidRoles()))
		}

		// Validate all user identifiers in this group
		userIdentifiers := strings.Split(group.UserIDs, ",")
		for _, userIdentifier := range userIdentifiers {
			userIdentifier = strings.TrimSpace(userIdentifier)
			if userIdentifier == "" {
				continue // Skip empty entries
			}

			// Check if this looks like it's intended to be an email
			if looksLikeEmail(userIdentifier) {
				// This looks like it's intended to be an email, so validate it strictly
				if !validateEmail(userIdentifier) {
					log.Printf("Invalid email format: '%s' in group %d", userIdentifier, groupIndex)
					return respondLambdaWithStatus(http.StatusBadRequest, false, fmt.Sprintf("Invalid email format: '%s' in group %d. Email addresses must contain @ symbol and be properly formatted (e.g., user@domain.com).", userIdentifier, groupIndex))
				}
			} else {
				// This should be a user ID - validate it's reasonable
				if len(userIdentifier) < 2 {
					log.Printf("Invalid user ID: '%s' in group %d (too short)", userIdentifier, groupIndex)
					return respondLambdaWithStatus(http.StatusBadRequest, false, fmt.Sprintf("Invalid user ID: '%s' in group %d (too short)", userIdentifier, groupIndex))
				}
			}
		}
	}

	log.Printf("Request validation passed for project '%s'", req.AppID)

	// Get Nobl9 credentials from AWS Parameter Store and KMS
	credentials, err := getNobl9Credentials(ctx)
	if err != nil {
		log.Printf("Failed to retrieve Nobl9 credentials: %v", err)
		return respondLambdaWithStatus(http.StatusInternalServerError, false, "Failed to retrieve Nobl9 credentials: "+err.Error())
	}

	// Set environment variables for the Nobl9 SDK
	os.Setenv("NOBL9_SDK_CLIENT_ID", credentials.ClientID)
	os.Setenv("NOBL9_SDK_CLIENT_SECRET", credentials.ClientSecret)
	
	// Fix for Lambda: Set HOME to /tmp to avoid "HOME is not defined" error
	// The Nobl9 SDK tries to access the HOME directory for config/cache files
	// but in Lambda, $HOME points to a non-existent read-only directory
	os.Setenv("HOME", "/tmp")

	// Create a context with timeout for all SDK operations
	sdkCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	// Initialize the Nobl9 client using the same method as your CLI tool
	client, err := sdk.DefaultClient()
	if err != nil {
		log.Printf("Failed to initialize Nobl9 SDK client: %v", err)
		return respondLambdaWithStatus(http.StatusInternalServerError, false, "Failed to initialize Nobl9 SDK client: "+err.Error())
	}

	// Step 1: Check if project already exists
	// We'll try to get the project by creating a project object and checking if it exists
	// Note: The Nobl9 SDK doesn't have a direct "project exists" check, so we'll try to create
	// and handle the error if it already exists

	// Step 2: Create the project
	// Create a new project manifest object with description from the request
	// If no description is provided, use a default one
	description := req.Description
	if description == "" {
		description = fmt.Sprintf("Project created via API: %s", req.AppID)
	}

	project := v1alphaProject.New(
		v1alphaProject.Metadata{
			Name: req.AppID,
		},
		v1alphaProject.Spec{
			Description: description,
		},
	)

	log.Printf("Creating project '%s' with description: %s", req.AppID, description)

	// Step 3: Prepare role bindings for each user group
	var roleBindings []manifest.Object
	var errors []string

	// Process each user group
	for groupIndex, group := range req.UserGroups {
		// Split the comma-separated user IDs/emails
		userIdentifiers := strings.Split(group.UserIDs, ",")

		// Process each user in the group
		for _, userIdentifier := range userIdentifiers {
			userIdentifier = strings.TrimSpace(userIdentifier)
			if userIdentifier == "" {
				continue // Skip empty entries
			}

			// We already validated the format above, so now we just need to process
			var userID string
			if strings.Contains(userIdentifier, "@") {
				// This is an email, try to get the user by email
				log.Printf("Looking up user by email: %s", userIdentifier)
				user, err := client.Users().V2().GetUser(sdkCtx, userIdentifier)
				if err != nil {
					errorMsg := fmt.Sprintf("Error retrieving user '%s': %v", userIdentifier, err)
					log.Print(errorMsg)
					errors = append(errors, errorMsg)
					continue
				}
				if user == nil {
					errorMsg := fmt.Sprintf("User with email '%s' not found in Nobl9", userIdentifier)
					log.Print(errorMsg)
					errors = append(errors, errorMsg)
					continue
				}
				userID = user.UserID
				log.Printf("Found user: %s -> %s", userIdentifier, userID)
			} else {
				// This is a user ID
				userID = userIdentifier
				log.Printf("Using provided user ID: %s", userID)
			}

			// Generate a unique name for the role binding
			// Use the same naming convention as your CLI tool
			sanitizedProject := sanitizeName(req.AppID)
			sanitizedUser := sanitizeName(userIdentifier)
			// Truncate components to ensure the final name is within the 63-char limit required by Nobl9.
			// The name has a fixed overhead: "assign--gX-" + a 10-digit timestamp = ~22 chars.
			// This leaves ~41 chars for the project and user. We'll allocate 20 to each.
			truncatedProject := truncate(sanitizedProject, 20)
			truncatedUser := truncate(sanitizedUser, 20)

			roleBindingName := fmt.Sprintf("assign-%s-%s-g%d-%d",
				truncatedProject,
				truncatedUser,
				groupIndex,
				time.Now().Unix())

			// Create the role binding object
			roleBinding := v1alphaRoleBinding.New(
				v1alphaRoleBinding.Metadata{
					Name: roleBindingName,
				},
				v1alphaRoleBinding.Spec{
					User:       ptr(userID), // Use the user's ID
					RoleRef:    group.Role,  // Role from the request
					ProjectRef: req.AppID,   // Project we just created
				},
			)

			roleBindings = append(roleBindings, roleBinding)
			log.Printf("Created role binding manifest: %s for user %s with role %s", roleBindingName, userID, group.Role)
		}
	}

	// If we had errors finding users, we can't proceed.
	// The project has not been created yet, so we just report the errors.
	if len(errors) > 0 {
		errorMsg := fmt.Sprintf("Failed to create project '%s' because some users could not be found:\n• %s",
			req.AppID, strings.Join(errors, "\n• "))
		log.Print(errorMsg)
		return respondLambdaWithStatus(http.StatusBadRequest, false, errorMsg)
	}

	// Step 4: Apply the project and all role bindings in a single atomic operation
	allObjects := []manifest.Object{project}
	if len(roleBindings) > 0 {
		allObjects = append(allObjects, roleBindings...)
	}

	log.Printf("Applying %d objects to Nobl9 (1 project + %d role bindings)", len(allObjects), len(roleBindings))

	if err := client.Objects().V1().Apply(sdkCtx, allObjects); err != nil {
		// Check if the error is because the project already exists
		if strings.Contains(err.Error(), "already exists") || strings.Contains(err.Error(), "conflict") {
			log.Printf("Project '%s' already exists", req.AppID)
			return respondLambdaWithStatus(http.StatusConflict, false, fmt.Sprintf("Project '%s' already exists", req.AppID))
		}

		log.Printf("Failed to create project and assign roles: %v", err)
		return respondLambdaWithStatus(http.StatusInternalServerError, false, fmt.Sprintf("Failed to create project and assign roles: %v", err))
	}

	log.Printf("Successfully created project '%s' and applied %d role bindings", req.AppID, len(roleBindings))

	// Success! Report back to the client
	message := fmt.Sprintf("Project '%s' created successfully with %d user role assignments", req.AppID, len(roleBindings))
	return respondLambda(true, message)
}

// respondLambda sends a JSON response for Lambda with 200 status code
func respondLambda(success bool, message string) (events.APIGatewayProxyResponse, error) {
	return respondLambdaWithStatus(http.StatusOK, success, message)
}

// respondLambdaWithStatus sends a JSON response for Lambda with custom status code
func respondLambdaWithStatus(statusCode int, success bool, message string) (events.APIGatewayProxyResponse, error) {
	// Create the response object
	response := Response{
		Success: success,
		Message: message,
	}

	// Encode the JSON response
	responseBody, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshaling JSON response: %v", err)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
			Body:       "Internal server error",
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
		}, nil
	}

	// Log the response for debugging
	if success {
		log.Printf("SUCCESS: %s", message)
	} else {
		log.Printf("ERROR: %s", message)
	}

	// Return the Lambda response
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Body:       string(responseBody),
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
		},
	}, nil
}

// handleRequest is the main Lambda handler that routes requests to appropriate handlers
func handleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Configure TLS before processing any requests
	configureTLS()

	// Log incoming request
	log.Printf("Received %s request to %s", request.HTTPMethod, request.Path)

	// Handle CORS preflight requests
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
			},
		}, nil
	}

	// Route requests based on the path
	switch request.Path {
	case "/health":
		return handleHealthCheck(ctx, request)
	case "/api/create-project":
		return handleCreateProject(ctx, request)
	default:
		log.Printf("404 Not Found: %s", request.Path)
		return respondLambdaWithStatus(http.StatusNotFound, false, "Not found")
	}
}

// init initializes AWS clients and other global resources
func init() {
	log.Println("Initializing Nobl9 Wizard Lambda function...")

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatalf("Failed to load AWS config: %v", err)
	}

	// Initialize AWS service clients
	kmsClient = kms.NewFromConfig(cfg)
	ssmClient = ssm.NewFromConfig(cfg)

	log.Println("AWS clients initialized successfully")
}

// main function starts the Lambda handler
func main() {
	log.Println("Starting Nobl9 Wizard Lambda function...")
	lambda.Start(handleRequest)
}
