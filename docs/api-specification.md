# API Specification: Nobl9 AWS Serverless Onboarding App

This document provides the complete API specification for the Nobl9 AWS Serverless Onboarding App, following the [OpenAPI 3.1.1 specification](https://swagger.io/specification/).

## Table of Contents

1. [Overview](#overview)
2. [Base Information](#base-information)
3. [Authentication](#authentication)
4. [Endpoints](#endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [CORS Support](#cors-support)
9. [Examples](#examples)
10. [SDK Examples](#sdk-examples)

## Overview

The Nobl9 AWS Serverless Onboarding App provides a RESTful API for creating Nobl9 projects and assigning user roles. The API is built on AWS Lambda with API Gateway and supports CORS for web application integration.

### API Version
- **Current Version**: 1.0.0
- **Base URL**: `https://{api-gateway-id}.execute-api.{region}.amazonaws.com/prod`
- **Protocol**: HTTPS
- **Content Type**: `application/json`

## Base Information

```yaml
openapi: 3.1.1
info:
  title: Nobl9 AWS Serverless Onboarding API
  description: |
    RESTful API for creating Nobl9 projects and assigning user roles.
    
    This API provides endpoints for:
    - Health checking and monitoring
    - Project creation with user role assignments
    - CORS support for web applications
    
    The API integrates with Nobl9's platform to create projects and manage user access.
  version: 1.0.0
  contact:
    name: Nobl9 Onboarding App Support
    url: https://github.com/your-org/Nobl9-wizard/issues
  license:
    name: Mozilla Public License 2.0
    url: https://opensource.org/licenses/MPL-2.0
servers:
  - url: https://{api-gateway-id}.execute-api.{region}.amazonaws.com/prod
    description: Production API Gateway endpoint
    variables:
      api-gateway-id:
        description: Your API Gateway ID
        default: "your-api-gateway-id"
      region:
        description: AWS region
        default: "us-east-1"
  - url: https://{custom-domain}
    description: Custom domain endpoint (if configured)
    variables:
      custom-domain:
        description: Your custom domain
        default: "api.your-domain.com"
```

## Authentication

The API uses **AWS IAM authentication** to restrict access to authorized frontend applications only. All API requests must be signed using AWS Signature Version 4 (SigV4) with valid AWS credentials.

**Security Features**:
- IAM authentication for all endpoints via API Gateway
- Cognito Identity Pool for browser-based credential management
- Rate limiting and usage tracking via API Gateway
- CORS restrictions to frontend domains only
- Secure credential management through AWS STS

```yaml
components:
  securitySchemes:
    iamAuth:
      type: http
      scheme: aws4-hmac-sha256
      description: AWS IAM authentication using Signature Version 4
      required: true
```

## Endpoints

### Health Check

#### GET /health

Returns the health status of the API and basic information about the service.

```yaml
paths:
  /health:
    get:
      summary: Health Check
      description: |
        Returns the current health status of the API service.
        This endpoint is useful for monitoring and load balancer health checks.
      operationId: getHealth
      tags:
        - Monitoring
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
              example:
                status: "healthy"
                version: "1.0.0"
                timestamp: "2024-01-01T00:00:00Z"
                uptime: 3600
        '500':
          description: Service is unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Service unavailable"
                error: "INTERNAL_ERROR"
```

### Project Creation

#### POST /api/create-project

Creates a new Nobl9 project and assigns user roles.

```yaml
  /api/create-project:
    post:
      summary: Create Nobl9 Project
      description: |
        Creates a new project in Nobl9 and assigns specified users with their roles.
        
        The project name (appID) must be:
        - 3-63 characters long
        - Contain only lowercase letters, numbers, and hyphens
        - Cannot start or end with a hyphen
        - Must be unique within the Nobl9 organization
        
        User roles can be:
        - `project-owner`: Full project access and management
        - `project-editor`: Can edit project configurations and data
        - `project-viewer`: Read-only access to project data
      operationId: createProject
      tags:
        - Projects
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProjectRequest'
            examples:
              basic:
                summary: Basic project creation
                value:
                  appID: "my-project"
                  description: "A new project for monitoring"
                  userGroups:
                    - userIds: "admin@company.com"
                      role: "project-owner"
                    - userIds: "team@company.com,viewer@company.com"
                      role: "project-viewer"
              complex:
                summary: Complex project with multiple groups
                value:
                  appID: "production-monitoring"
                  description: "Production environment monitoring project"
                  userGroups:
                    - userIds: "admin@company.com"
                      role: "project-owner"
                    - userIds: "dev-team@company.com,qa-team@company.com"
                      role: "project-editor"
                    - userIds: "stakeholder@company.com,manager@company.com"
                      role: "project-viewer"
      responses:
        '200':
          description: Project created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateProjectResponse'
              example:
                success: true
                message: "Project 'my-project' created successfully with 2 user role assignments"
                projectId: "my-project"
                userAssignments: 2
        '400':
          description: Bad request - validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                invalid_project_name:
                  summary: Invalid project name
                  value:
                    success: false
                    message: "project name can only contain lowercase letters, numbers, and hyphens"
                    error: "VALIDATION_ERROR"
                missing_user_groups:
                  summary: Missing user groups
                  value:
                    success: false
                    message: "At least one user group is required"
                    error: "VALIDATION_ERROR"
                invalid_role:
                  summary: Invalid role
                  value:
                    success: false
                    message: "Invalid role 'invalid-role' in group 0. Must be one of: project-owner, project-viewer, project-editor"
                    error: "VALIDATION_ERROR"
        '409':
          description: Project already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Project 'my-project' already exists"
                error: "PROJECT_EXISTS"
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                success: false
                message: "Failed to create project due to Nobl9 API error"
                error: "NOBL9_API_ERROR"
    options:
      summary: CORS Preflight
      description: |
        Handles CORS preflight requests for the create-project endpoint.
        This allows web applications to make cross-origin requests.
      operationId: createProjectOptions
      tags:
        - CORS
      responses:
        '200':
          description: CORS preflight successful
          headers:
            Access-Control-Allow-Origin:
              description: Allowed origin
              schema:
                type: string
                example: "*"
            Access-Control-Allow-Methods:
              description: Allowed HTTP methods
              schema:
                type: string
                example: "POST, OPTIONS"
            Access-Control-Allow-Headers:
              description: Allowed headers
              schema:
                type: string
                example: "Content-Type, Authorization"
            Access-Control-Max-Age:
              description: Cache duration for preflight response
              schema:
                type: string
                example: "86400"
```

## Data Models

### HealthResponse

```yaml
components:
  schemas:
    HealthResponse:
      type: object
      required:
        - status
        - version
        - timestamp
      properties:
        status:
          type: string
          enum: [healthy, unhealthy]
          description: Current health status of the service
          example: "healthy"
        version:
          type: string
          description: API version
          example: "1.0.0"
        timestamp:
          type: string
          format: date-time
          description: Current server timestamp
          example: "2024-01-01T00:00:00Z"
        uptime:
          type: integer
          description: Service uptime in seconds
          example: 3600
```

### CreateProjectRequest

```yaml
    CreateProjectRequest:
      type: object
      required:
        - appID
        - userGroups
      properties:
        appID:
          type: string
          minLength: 3
          maxLength: 63
          pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
          description: |
            Unique project identifier (project name).
            Must be 3-63 characters, lowercase letters, numbers, and hyphens only.
            Cannot start or end with a hyphen.
          example: "my-project"
        description:
          type: string
          maxLength: 255
          description: Optional project description
          example: "A new project for monitoring our services"
        userGroups:
          type: array
          minItems: 1
          maxItems: 10
          items:
            $ref: '#/components/schemas/UserGroup'
          description: List of user groups with their assigned roles
```

### UserGroup

```yaml
    UserGroup:
      type: object
      required:
        - userIds
        - role
      properties:
        userIds:
          type: string
          description: |
            Comma-separated list of user identifiers.
            Can be email addresses or Nobl9 user IDs.
            Maximum 8 users per group.
          example: "user1@company.com,user2@company.com"
        role:
          type: string
          enum: [project-owner, project-editor, project-viewer]
          description: |
            Role to assign to all users in this group.
            - project-owner: Full project access and management
            - project-editor: Can edit project configurations and data
            - project-viewer: Read-only access to project data
          example: "project-owner"
```

### CreateProjectResponse

```yaml
    CreateProjectResponse:
      type: object
      required:
        - success
        - message
        - projectId
        - userAssignments
      properties:
        success:
          type: boolean
          description: Indicates if the operation was successful
          example: true
        message:
          type: string
          description: Human-readable success message
          example: "Project 'my-project' created successfully with 2 user role assignments"
        projectId:
          type: string
          description: The created project ID
          example: "my-project"
        userAssignments:
          type: integer
          description: Number of user role assignments created
          example: 2
```

### ErrorResponse

```yaml
    ErrorResponse:
      type: object
      required:
        - success
        - message
        - error
      properties:
        success:
          type: boolean
          description: Always false for error responses
          example: false
        message:
          type: string
          description: Human-readable error message
          example: "Project name can only contain lowercase letters, numbers, and hyphens"
        error:
          type: string
          enum:
            - VALIDATION_ERROR
            - PROJECT_EXISTS
            - NOBL9_API_ERROR
            - CREDENTIAL_ERROR
            - INTERNAL_ERROR
            - NOT_FOUND
            - METHOD_NOT_ALLOWED
          description: Error type for programmatic handling
          example: "VALIDATION_ERROR"
        details:
          type: object
          description: Additional error details (optional)
          additionalProperties: true
```

## Error Handling

The API uses standard HTTP status codes and provides detailed error responses:

### HTTP Status Codes

- **200 OK**: Request successful
- **400 Bad Request**: Validation error or invalid input
- **404 Not Found**: Endpoint not found
- **405 Method Not Allowed**: HTTP method not supported
- **409 Conflict**: Project already exists
- **500 Internal Server Error**: Server error or Nobl9 API error

### Error Types

- **VALIDATION_ERROR**: Input validation failed
- **PROJECT_EXISTS**: Project with the same name already exists
- **NOBL9_API_ERROR**: Error communicating with Nobl9 API
- **CREDENTIAL_ERROR**: Authentication or authorization error
- **INTERNAL_ERROR**: Internal server error
- **NOT_FOUND**: Resource not found
- **METHOD_NOT_ALLOWED**: HTTP method not allowed

## Rate Limiting

The API is subject to AWS API Gateway rate limits:

- **Default Limit**: 10,000 requests per second per region
- **Burst Limit**: 5,000 requests per second
- **Account Limit**: 10,000 requests per second across all APIs

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests per time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## CORS Support

The API supports Cross-Origin Resource Sharing (CORS) for web applications:

### CORS Headers

```yaml
components:
  responses:
    CORSResponse:
      description: CORS-enabled response
      headers:
        Access-Control-Allow-Origin:
          description: Allowed origin
          schema:
            type: string
            example: "*"
        Access-Control-Allow-Methods:
          description: Allowed HTTP methods
          schema:
            type: string
            example: "GET, POST, OPTIONS"
        Access-Control-Allow-Headers:
          description: Allowed headers
          schema:
            type: string
            example: "Content-Type, Authorization"
        Access-Control-Max-Age:
          description: Cache duration for preflight response
          schema:
            type: string
            example: "86400"
```

### Supported Origins

- `*` (for development)
- `https://your-frontend-bucket.s3-website-region.amazonaws.com`
- `https://your-custom-domain.com`

## Examples

### Health Check Request

```bash
curl -X GET https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600
}
```

### Create Project Request

```bash
curl -X POST https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/api/create-project \
  -H "Content-Type: application/json" \
  -d '{
    "appID": "production-monitoring",
    "description": "Production environment monitoring project",
    "userGroups": [
      {
        "userIds": "admin@company.com",
        "role": "project-owner"
      },
      {
        "userIds": "dev-team@company.com,qa-team@company.com",
        "role": "project-editor"
      },
      {
        "userIds": "stakeholder@company.com",
        "role": "project-viewer"
      }
    ]
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "Project 'production-monitoring' created successfully with 3 user role assignments",
  "projectId": "production-monitoring",
  "userAssignments": 3
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Project 'production-monitoring' already exists",
  "error": "PROJECT_EXISTS"
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
interface CreateProjectRequest {
  appID: string;
  description?: string;
  userGroups: Array<{
    userIds: string;
    role: 'project-owner' | 'project-editor' | 'project-viewer';
  }>;
}

interface CreateProjectResponse {
  success: boolean;
  message: string;
  projectId: string;
  userAssignments: number;
}

class Nobl9OnboardingAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async createProject(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    const response = await fetch(`${this.baseUrl}/api/create-project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}

// Usage
const api = new Nobl9OnboardingAPI('https://your-api-gateway-url.execute-api.region.amazonaws.com/prod');

try {
  const result = await api.createProject({
    appID: 'my-project',
    description: 'Test project',
    userGroups: [
      { userIds: 'admin@company.com', role: 'project-owner' }
    ]
  });
  console.log('Project created:', result.message);
} catch (error) {
  console.error('Failed to create project:', error);
}
```

### Python

```python
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class UserGroup:
    userIds: str
    role: str

@dataclass
class CreateProjectRequest:
    appID: str
    description: Optional[str] = None
    userGroups: List[UserGroup] = None

class Nobl9OnboardingAPI:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
    
    def create_project(self, request: CreateProjectRequest) -> Dict:
        """Create a new Nobl9 project with user role assignments."""
        url = f"{self.base_url}/api/create-project"
        
        # Convert dataclass to dict
        payload = {
            "appID": request.appID,
            "userGroups": [
                {"userIds": group.userIds, "role": group.role}
                for group in request.userGroups
            ]
        }
        
        if request.description:
            payload["description"] = request.description
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        return response.json()
    
    def get_health(self) -> Dict:
        """Get API health status."""
        url = f"{self.base_url}/health"
        response = requests.get(url)
        response.raise_for_status()
        return response.json()

# Usage
api = Nobl9OnboardingAPI('https://your-api-gateway-url.execute-api.region.amazonaws.com/prod')

try:
    request = CreateProjectRequest(
        appID="python-test-project",
        description="Project created via Python SDK",
        userGroups=[
            UserGroup(userIds="admin@company.com", role="project-owner"),
            UserGroup(userIds="team@company.com", role="project-editor")
        ]
    )
    
    result = api.create_project(request)
    print(f"Project created: {result['message']}")
    
except requests.exceptions.RequestException as e:
    print(f"API request failed: {e}")
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type UserGroup struct {
    UserIds string `json:"userIds"`
    Role    string `json:"role"`
}

type CreateProjectRequest struct {
    AppID       string      `json:"appID"`
    Description string      `json:"description,omitempty"`
    UserGroups  []UserGroup `json:"userGroups"`
}

type CreateProjectResponse struct {
    Success        bool   `json:"success"`
    Message        string `json:"message"`
    ProjectID      string `json:"projectId"`
    UserAssignments int   `json:"userAssignments"`
}

type HealthResponse struct {
    Status    string `json:"status"`
    Version   string `json:"version"`
    Timestamp string `json:"timestamp"`
    Uptime    int    `json:"uptime,omitempty"`
}

type Nobl9OnboardingAPI struct {
    BaseURL string
    Client  *http.Client
}

func NewNobl9OnboardingAPI(baseURL string) *Nobl9OnboardingAPI {
    return &Nobl9OnboardingAPI{
        BaseURL: baseURL,
        Client:  &http.Client{},
    }
}

func (api *Nobl9OnboardingAPI) CreateProject(request CreateProjectRequest) (*CreateProjectResponse, error) {
    jsonData, err := json.Marshal(request)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal request: %w", err)
    }

    url := fmt.Sprintf("%s/api/create-project", api.BaseURL)
    resp, err := api.Client.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("failed to make request: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("API request failed with status: %d", resp.StatusCode)
    }

    var response CreateProjectResponse
    if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &response, nil
}

func (api *Nobl9OnboardingAPI) GetHealth() (*HealthResponse, error) {
    url := fmt.Sprintf("%s/health", api.BaseURL)
    resp, err := api.Client.Get(url)
    if err != nil {
        return nil, fmt.Errorf("failed to make request: %w", err)
    }
    defer resp.Body.Close()

    var response HealthResponse
    if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &response, nil
}

// Usage
func main() {
    api := NewNobl9OnboardingAPI("https://your-api-gateway-url.execute-api.region.amazonaws.com/prod")

    request := CreateProjectRequest{
        AppID:       "go-test-project",
        Description: "Project created via Go SDK",
        UserGroups: []UserGroup{
            {UserIds: "admin@company.com", Role: "project-owner"},
            {UserIds: "team@company.com", Role: "project-editor"},
        },
    }

    result, err := api.CreateProject(request)
    if err != nil {
        fmt.Printf("Failed to create project: %v\n", err)
        return
    }

    fmt.Printf("Project created: %s\n", result.Message)
}
```

## Integration Guidelines

### Best Practices

1. **Error Handling**: Always check for error responses and handle them appropriately
2. **Validation**: Validate input data before sending requests
3. **Rate Limiting**: Implement exponential backoff for rate limit errors
4. **Retry Logic**: Retry failed requests with appropriate backoff strategies
5. **Logging**: Log API requests and responses for debugging

### Security Considerations

1. **HTTPS Only**: Always use HTTPS for API communication
2. **Input Validation**: Validate all input data on both client and server
3. **Error Information**: Don't expose sensitive information in error messages
4. **CORS Configuration**: Configure CORS appropriately for your domain
5. **Public Access**: The API is publicly accessible - implement additional security if needed
6. **Rate Limiting**: Monitor usage and implement rate limiting for production use

### Monitoring and Observability

1. **Health Checks**: Regularly check the `/health` endpoint
2. **Error Tracking**: Monitor error rates and types
3. **Performance**: Track API response times
4. **Usage Metrics**: Monitor API usage patterns

## Versioning

The API follows semantic versioning (SemVer):

- **Major Version**: Breaking changes (new major version)
- **Minor Version**: New features (backward compatible)
- **Patch Version**: Bug fixes (backward compatible)

Version information is available in the health check response and API documentation.

## Support

For API support and questions:

- **Documentation**: This specification document
- **Issues**: [GitHub Issues](https://github.com/your-org/Nobl9-wizard/issues)
- **Examples**: See the SDK examples above
- **Testing**: Use the provided examples to test your integration 