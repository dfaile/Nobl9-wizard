import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the config module
jest.mock('./config', () => ({
  config: {
    features: {
      enableDebugMode: false
    },
    helpUrl: 'https://docs.nobl9.com',
    apiEndpoint: 'https://test-api.com',
    version: '1.0.0',
    environment: 'test'
  }
}));

describe('App Component', () => {
  it('should render the main application structure', () => {
    render(<App />);
    
    // Check for main header
    expect(screen.getByText('Nobl9 Wizard')).toBeInTheDocument();
    expect(screen.getByText('Project Self-Service Portal')).toBeInTheDocument();
    
    // Check for main content
    expect(screen.getByText('Create a New Nobl9 Project')).toBeInTheDocument();
    expect(screen.getByText(/Use this wizard to create a new project/)).toBeInTheDocument();
    
    // Check for footer
    expect(screen.getByText(/© 2024 Nobl9 Wizard/)).toBeInTheDocument();
  });

  it('should render help link with correct URL', () => {
    render(<App />);
    
    const helpLink = screen.getByText(/View Nobl9 Documentation/);
    expect(helpLink).toBeInTheDocument();
    expect(helpLink).toHaveAttribute('href', 'https://docs.nobl9.com');
    expect(helpLink).toHaveAttribute('target', '_blank');
    expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should not show debug information when debug mode is disabled', () => {
    render(<App />);
    
    expect(screen.queryByText(/Version:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Environment:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/API Endpoint:/)).not.toBeInTheDocument();
  });

  it('should show debug information when debug mode is enabled', () => {
    // Mock config with debug mode enabled
    jest.doMock('./config', () => ({
      config: {
        features: {
          enableDebugMode: true
        },
        helpUrl: 'https://docs.nobl9.com',
        apiEndpoint: 'https://test-api.com',
        version: '1.0.0',
        environment: 'test'
      }
    }));

    // Re-import App to get the new mock
    const { default: AppWithDebug } = require('./App');
    render(<AppWithDebug />);
    
    expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/Environment: test/)).toBeInTheDocument();
    expect(screen.getByText(/API Endpoint: https:\/\/test-api.com/)).toBeInTheDocument();
  });

  it('should render ProjectForm component', () => {
    render(<App />);
    
    // Check that ProjectForm is rendered (by looking for its elements)
    expect(screen.getByLabelText(/Project Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it('should have proper semantic HTML structure', () => {
    render(<App />);
    
    // Check for proper HTML structure
    expect(screen.getByRole('banner')).toBeInTheDocument(); // header
    expect(screen.getByRole('main')).toBeInTheDocument(); // main content
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
  });

  it('should have accessible navigation', () => {
    render(<App />);
    
    // Check for proper heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Nobl9 Wizard');
    
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Create a New Nobl9 Project');
  });
}); 