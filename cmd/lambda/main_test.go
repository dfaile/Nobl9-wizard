package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

// Test helper functions
func TestPtr(t *testing.T) {
	s := "test"
	result := ptr(s)
	if *result != s {
		t.Errorf("ptr() = %v, want %v", *result, s)
	}
}

func TestSanitizeName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"My Project", "my-project"},
		{"project-123", "project-123"},
		{"Project@#$%", "project"},
		{"  Project  ", "project"},
		{"", ""},
		{"A", "a"},
		{"My-Project-Name", "my-project-name"},
		{"Project@#$%Name", "project-name"},
	}

	for _, tt := range tests {
		result := sanitizeName(tt.input)
		if result != tt.expected {
			t.Errorf("sanitizeName(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		input    string
		maxLen   int
		expected string
	}{
		{"hello", 3, "hel"},
		{"hello", 10, "hello"},
		{"", 5, ""},
		{"test", 0, ""},
	}

	for _, tt := range tests {
		result := truncate(tt.input, tt.maxLen)
		if result != tt.expected {
			t.Errorf("truncate(%q, %d) = %q, want %q", tt.input, tt.maxLen, result, tt.expected)
		}
	}
}

func TestLooksLikeEmail(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"user@example.com", true},
		{"test.com", true},
		{"user@test.org", true},
		{"user@test.io", true},
		{"user@test.dev", true},
		{"username", false},
		{"123", false},
		{"", false},
	}

	for _, tt := range tests {
		result := looksLikeEmail(tt.input)
		if result != tt.expected {
			t.Errorf("looksLikeEmail(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestValidateEmail(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"user@example.com", true},
		{"test.user@domain.org", true},
		{"user+tag@example.co.uk", true},
		{"invalid-email", false},
		{"@example.com", false},
		{"user@", false},
		{"", false},
		{"user@.com", false},
	}

	for _, tt := range tests {
		result := validateEmail(tt.input)
		if result != tt.expected {
			t.Errorf("validateEmail(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestValidateProjectName(t *testing.T) {
	tests := []struct {
		input    string
		expected error
	}{
		{"valid-project", nil},
		{"project123", nil},
		{"my-project-name", nil},
		{"", fmt.Errorf("project name cannot be empty")},
		{"ab", fmt.Errorf("project name must be at least 3 characters long")},
		{strings.Repeat("a", 64), fmt.Errorf("project name must be less than 63 characters")},
		{"Invalid-Project", fmt.Errorf("project name can only contain lowercase letters, numbers, and hyphens")},
		{"project@name", fmt.Errorf("project name can only contain lowercase letters, numbers, and hyphens")},
		{"-project", fmt.Errorf("project name cannot start or end with a hyphen")},
		{"project-", fmt.Errorf("project name cannot start or end with a hyphen")},
	}

	for _, tt := range tests {
		result := validateProjectName(tt.input)
		if (result == nil) != (tt.expected == nil) {
			t.Errorf("validateProjectName(%q) = %v, want %v", tt.input, result, tt.expected)
		} else if result != nil && tt.expected != nil && result.Error() != tt.expected.Error() {
			t.Errorf("validateProjectName(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestGetValidRoles(t *testing.T) {
	result := getValidRoles()
	expectedRoles := []string{"project-owner", "project-viewer", "project-editor"}

	for _, role := range expectedRoles {
		if !strings.Contains(result, role) {
			t.Errorf("getValidRoles() missing role: %s", role)
		}
	}
}

func TestHandleHealthCheck(t *testing.T) {
	// Test valid GET request
	request := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/health",
	}

	response, err := handleHealthCheck(context.Background(), request)
	if err != nil {
		t.Errorf("handleHealthCheck() error = %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Errorf("handleHealthCheck() status = %d, want %d", response.StatusCode, http.StatusOK)
	}

	// Parse response body
	var healthResp HealthResponse
	if err := json.Unmarshal([]byte(response.Body), &healthResp); err != nil {
		t.Errorf("Failed to parse health response: %v", err)
	}

	if healthResp.Status != "healthy" {
		t.Errorf("Health status = %s, want 'healthy'", healthResp.Status)
	}

	if healthResp.Version != appVersion {
		t.Errorf("Version = %s, want %s", healthResp.Version, appVersion)
	}

	// Test invalid method
	request.HTTPMethod = "POST"
	response, err = handleHealthCheck(context.Background(), request)
	if err != nil {
		t.Errorf("handleHealthCheck() error = %v", err)
	}

	if response.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("handleHealthCheck() status = %d, want %d", response.StatusCode, http.StatusMethodNotAllowed)
	}
}

func TestHandleCreateProjectValidation(t *testing.T) {
	// Test empty request body
	request := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		Path:       "/api/create-project",
		Body:       "",
	}

	response, err := handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test invalid JSON
	request.Body = `{"invalid": json}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test missing project name
	request.Body = `{"userGroups": [{"userIds": "user@example.com", "role": "project-owner"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test invalid project name
	request.Body = `{"appID": "ab", "userGroups": [{"userIds": "user@example.com", "role": "project-owner"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test missing user groups
	request.Body = `{"appID": "valid-project"}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test invalid role
	request.Body = `{"appID": "valid-project", "userGroups": [{"userIds": "user@example.com", "role": "invalid-role"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test invalid email (should return 400)
	request.Body = `{"appID": "valid-project", "userGroups": [{"userIds": "invalid-email@", "role": "project-owner"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Test invalid method
	request.HTTPMethod = "GET"
	request.Body = `{"appID": "valid-project", "userGroups": [{"userIds": "user@example.com", "role": "project-owner"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusMethodNotAllowed)
	}

	// Test valid input but missing credentials (should return 500)
	request.HTTPMethod = "POST"
	request.Body = `{"appID": "valid-project", "userGroups": [{"userIds": "user@example.com", "role": "project-owner"}]}`
	response, err = handleCreateProject(context.Background(), request)
	if err != nil {
		t.Errorf("handleCreateProject() error = %v", err)
	}

	if response.StatusCode != http.StatusInternalServerError {
		t.Errorf("handleCreateProject() status = %d, want %d", response.StatusCode, http.StatusInternalServerError)
	}
}

func TestHandleRequest(t *testing.T) {
	// Test health endpoint
	request := events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/health",
	}

	response, err := handleRequest(context.Background(), request)
	if err != nil {
		t.Errorf("handleRequest() error = %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Errorf("handleRequest() status = %d, want %d", response.StatusCode, http.StatusOK)
	}

	// Test create project endpoint
	request = events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		Path:       "/api/create-project",
		Body:       `{"appID": "test-project", "userGroups": [{"userIds": "user@example.com", "role": "project-owner"}]}`,
	}

	response, err = handleRequest(context.Background(), request)
	if err != nil {
		t.Errorf("handleRequest() error = %v", err)
	}

	// Should fail due to missing AWS credentials, but should not crash
	if response.StatusCode == 0 {
		t.Errorf("handleRequest() returned invalid status code")
	}

	// Test CORS preflight
	request = events.APIGatewayProxyRequest{
		HTTPMethod: "OPTIONS",
		Path:       "/api/create-project",
	}

	response, err = handleRequest(context.Background(), request)
	if err != nil {
		t.Errorf("handleRequest() error = %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Errorf("handleRequest() status = %d, want %d", response.StatusCode, http.StatusOK)
	}

	// Test 404
	request = events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/nonexistent",
	}

	response, err = handleRequest(context.Background(), request)
	if err != nil {
		t.Errorf("handleRequest() error = %v", err)
	}

	if response.StatusCode != http.StatusNotFound {
		t.Errorf("handleRequest() status = %d, want %d", response.StatusCode, http.StatusNotFound)
	}
}

func TestRespondLambda(t *testing.T) {
	// Test success response
	response, err := respondLambda(true, "Success message")
	if err != nil {
		t.Errorf("respondLambda() error = %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Errorf("respondLambda() status = %d, want %d", response.StatusCode, http.StatusOK)
	}

	// Parse response body
	var resp Response
	if err := json.Unmarshal([]byte(response.Body), &resp); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Errorf("Response success = %v, want true", resp.Success)
	}

	if resp.Message != "Success message" {
		t.Errorf("Response message = %s, want 'Success message'", resp.Message)
	}

	// Test error response
	response, err = respondLambda(false, "Error message")
	if err != nil {
		t.Errorf("respondLambda() error = %v", err)
	}

	if response.StatusCode != http.StatusOK {
		t.Errorf("respondLambda() status = %d, want %d", response.StatusCode, http.StatusOK)
	}

	// Parse response body
	if err := json.Unmarshal([]byte(response.Body), &resp); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if resp.Success {
		t.Errorf("Response success = %v, want false", resp.Success)
	}

	if resp.Message != "Error message" {
		t.Errorf("Response message = %s, want 'Error message'", resp.Message)
	}
}

func TestRespondLambdaWithStatus(t *testing.T) {
	// Test with custom status code
	response, err := respondLambdaWithStatus(http.StatusBadRequest, false, "Bad request")
	if err != nil {
		t.Errorf("respondLambdaWithStatus() error = %v", err)
	}

	if response.StatusCode != http.StatusBadRequest {
		t.Errorf("respondLambdaWithStatus() status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}

	// Parse response body
	var resp Response
	if err := json.Unmarshal([]byte(response.Body), &resp); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if resp.Success {
		t.Errorf("Response success = %v, want false", resp.Success)
	}

	if resp.Message != "Bad request" {
		t.Errorf("Response message = %s, want 'Bad request'", resp.Message)
	}
}
