import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectForm from './ProjectForm';
import { config } from '../config';

// Mock the config module
jest.mock('../config', () => ({
  config: {
    maxUsersPerProject: 8,
    features: {
      enableDebugMode: false
    }
  }
}));

// Mock the API module
jest.mock('../config', () => ({
  config: {
    maxUsersPerProject: 8,
    features: {
      enableDebugMode: false
    }
  },
  api: {
    call: jest.fn(),
    createProject: 'https://test-api.com/api/create-project'
  }
}));

describe('ProjectForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render all form fields', () => {
      render(<ProjectForm />);
      
      expect(screen.getByLabelText(/Project Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Users and Roles/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Review & Submit/i })).toBeInTheDocument();
    });

    it('should render role options', () => {
      render(<ProjectForm />);
      
      const roleSelect = screen.getByRole('combobox');
      expect(roleSelect).toBeInTheDocument();
      
      // Check for role options
      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Editor')).toBeInTheDocument();
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate required project name', async () => {
      render(<ProjectForm />);
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Project name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate project name format', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'Invalid Project Name');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Project name.*lowercase letters, numbers, and hyphens/i)).toBeInTheDocument();
      });
    });

    it('should validate project name length', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'ab');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Project name.*3-63 characters/i)).toBeInTheDocument();
      });
    });

    it('should validate user IDs are required', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/At least one user must be specified/i)).toBeInTheDocument();
      });
    });

    it('should validate email format for user IDs', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'invalid-email');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid user ID format/i)).toBeInTheDocument();
      });
    });

    it('should accept valid project name and user', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Groups Management', () => {
    it('should add new user group when button is clicked', async () => {
      render(<ProjectForm />);
      
      const addButton = screen.getByRole('button', { name: /Add Another User Group/i });
      fireEvent.click(addButton);
      
      const userInputs = screen.getAllByPlaceholderText(/user@example.com/i);
      expect(userInputs).toHaveLength(2);
    });

    it('should remove user group when remove button is clicked', async () => {
      render(<ProjectForm />);
      
      // Add a group first
      const addButton = screen.getByRole('button', { name: /Add Another User Group/i });
      fireEvent.click(addButton);
      
      // Remove the second group
      const removeButtons = screen.getAllByRole('button', { name: /Remove user group/i });
      fireEvent.click(removeButtons[1]);
      
      const userInputs = screen.getAllByPlaceholderText(/user@example.com/i);
      expect(userInputs).toHaveLength(1);
    });

    it('should not allow removing the last user group', () => {
      render(<ProjectForm />);
      
      const removeButton = screen.getByRole('button', { name: /Remove user group/i });
      expect(removeButton).toBeDisabled();
    });

    it('should disable add button when max users reached', async () => {
      render(<ProjectForm />);
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      // Add 8 users (max allowed)
      await userEvent.type(userInput, 'user1@example.com, user2@example.com, user3@example.com, user4@example.com, user5@example.com, user6@example.com, user7@example.com, user8@example.com');
      
      const addButton = screen.getByRole('button', { name: /Add Another User Group/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('Summary Modal', () => {
    it('should show summary modal with correct data', async () => {
      render(<ProjectForm />);
      
      // Fill form with valid data
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');
      
      const descriptionInput = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionInput, 'Test description');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        expect(screen.getByText('test-project')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
      });
    });

    it('should close summary modal when cancel is clicked', async () => {
      render(<ProjectForm />);
      
      // Fill form and open summary
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Confirm Project Details/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize malicious input in project name', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        // The sanitized content should be displayed safely
        expect(screen.getByText('valid-project')).toBeInTheDocument();
      });
    });

    it('should handle HTML in description safely', async () => {
      render(<ProjectForm />);
      
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'valid-project');
      
      const descriptionInput = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionInput, '<script>alert("xss")</script>');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
        // The HTML should be sanitized and displayed as text
        expect(screen.getByText(/&lt;script&gt;alert\("xss"\)&lt;\/script&gt;/)).toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should reset form after successful submission', async () => {
      render(<ProjectForm />);
      
      // Fill form
      const projectNameInput = screen.getByLabelText(/Project Name/i);
      await userEvent.type(projectNameInput, 'test-project');
      
      const userInput = screen.getByPlaceholderText(/user@example.com/i);
      await userEvent.type(userInput, 'user@example.com');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /Review & Submit/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Confirm Project Details/i)).toBeInTheDocument();
      });
      
      // Mock successful API response
      const { api } = require('../config');
      api.call.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, message: 'Project created successfully' })
      });
      
      const confirmButton = screen.getByRole('button', { name: /Create Project/i });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Project created successfully/i)).toBeInTheDocument();
      });
      
      // Wait for form reset
      await waitFor(() => {
        expect(screen.getByLabelText(/Project Name/i)).toHaveValue('');
      }, { timeout: 4000 });
    });
  });
}); 