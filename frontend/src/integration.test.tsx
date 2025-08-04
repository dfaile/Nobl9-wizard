import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock all external dependencies
jest.mock('./config', () => ({
  config: {
    maxUsersPerProject: 8,
    features: {
      enableDebugMode: false
    },
    helpUrl: 'https://docs.nobl9.com',
    apiEndpoint: 'https://test-api.com',
    version: '1.0.0',
    environment: 'test'
  },
  api: {
    call: jest.fn(),
    createProject: 'https://test-api.com/api/create-project'
  }
}));

// Mock AWS SDK modules
jest.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: jest.fn(() => Promise.resolve({}))
}));

jest.mock('@aws-sdk/signature-v4', () => ({
  SignatureV4: jest.fn().mockImplementation(() => ({
    sign: jest.fn().mockResolvedValue({
      method: 'POST',
      headers: { 'Authorization': 'AWS4-HMAC-SHA256 ...' },
      body: 'test-body'
    })
  }))
}));

jest.mock('@aws-sdk/protocol-http', () => ({
  HttpRequest: jest.fn().mockImplementation((options) => options)
}));

jest.mock('@aws-crypto/sha256-browser', () => ({
  Sha256: jest.fn()
}));

describe('Application Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Workflow', () => {
    it('should handle complete project creation workflow', async () => {
      const { api } = require('./config');
      api.call.mockResolvedValueOnce({
        json: () => Promise.resolve({ 
          success: true, 
          message: 'Project "test-project" created successfully' 
        })
      });

      render(<App />);

      // Step 1: Fill out the form
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');

      const descriptionInput = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionInput, 'Integration test project');

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'test@example.com');

      // Step 2: Submit for review
      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      // Step 3: Verify summary modal appears
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        expect(screen.getByText('test-project')).toBeInTheDocument();
        expect(screen.getByText('Integration test project')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });

      // Step 4: Confirm creation
      const confirmButton = screen.getByRole('button', { name: /Create Project/i });
      fireEvent.click(confirmButton);

      // Step 5: Verify API call was made
      await waitFor(() => {
        expect(api.call).toHaveBeenCalledWith(
          'https://test-api.com/api/create-project',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('test-project')
          })
        );
      });

      // Step 6: Verify success message
      await waitFor(() => {
        expect(screen.getByText(/Project "test-project" created successfully/i)).toBeInTheDocument();
      });

      // Step 7: Verify form resets after success
      await waitFor(() => {
        expect(screen.getByLabelText(/Project Name/i)).toHaveValue('');
      }, { timeout: 4000 });
    });

    it('should handle API errors gracefully', async () => {
      const { api } = require('./config');
      api.call.mockRejectedValueOnce(new Error('Network error'));

      render(<App />);

      // Fill out form
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'test@example.com');

      // Submit for review
      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
      });

      // Confirm creation
      const confirmButton = screen.getByRole('button', { name: /Create Project/i });
      fireEvent.click(confirmButton);

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect to the server/i)).toBeInTheDocument();
      });
    });
  });

  describe('Security Integration', () => {
    it('should sanitize malicious input throughout the workflow', async () => {
      const { api } = require('./config');
      api.call.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, message: 'Project created' })
      });

      render(<App />);

      // Try to inject malicious content
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project'); // Use valid name to proceed

      const descriptionInput = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionInput, '<script>alert("xss")</script>');

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'test@example.com');

      // Submit for review
      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      // Verify malicious content is sanitized in summary
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        // The script tag should be escaped, not executed
        expect(screen.getByText(/&lt;script&gt;alert\("xss"\)&lt;\/script&gt;/)).toBeInTheDocument();
      });

      // Verify API call contains sanitized data
      const confirmButton = screen.getByRole('button', { name: /Create Project/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(api.call).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('valid-project')
          })
        );
      });
    });

    it('should reject invalid project names', async () => {
      render(<App />);

      // Try invalid project name
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'Invalid Project Name!');

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'test@example.com');

      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Project name.*lowercase letters, numbers, and hyphens/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Interface Integration', () => {
    it('should handle multiple user groups correctly', async () => {
      render(<App />);

      // Fill basic form
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');

      // Add first user
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user1@example.com');

      // Add another user group
      const addButton = screen.getByRole('button', { name: /Add Another User Group/i });
      fireEvent.click(addButton);

      // Fill second user group
      const userInputs = screen.getAllByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInputs[1], 'user2@example.com');

      // Change role for second group
      const roleSelects = screen.getAllByRole('combobox');
      fireEvent.change(roleSelects[1], { target: { value: 'project-viewer' } });

      // Submit for review
      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      // Verify both user groups appear in summary
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      });
    });

    it('should handle form cancellation correctly', async () => {
      render(<App />);

      // Fill form
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'test@example.com');

      // Submit for review
      const reviewButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(reviewButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
      });

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // Verify modal closes and form is still filled
      await waitFor(() => {
        expect(screen.queryByText(/Confirm Project Details/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Project Name/i)).toHaveValue('test-project');
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('should maintain proper focus management', async () => {
      render(<App />);

      // Check initial focus
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      expect(projectNameInput).toBeInTheDocument();

      // Tab through form elements
      projectNameInput.focus();
      expect(document.activeElement).toBe(projectNameInput);

      const descriptionInput = screen.getByLabelText(/Description/i);
      descriptionInput.focus();
      expect(document.activeElement).toBe(descriptionInput);

      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      userInput.focus();
      expect(document.activeElement).toBe(userInput);
    });

    it('should have proper ARIA labels and roles', () => {
      render(<App />);

      // Check for proper form structure
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review & Submit/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      // Check for proper labels
      expect(screen.getByLabelText(/Project Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Users and Roles/i)).toBeInTheDocument();
    });
  });
}); 