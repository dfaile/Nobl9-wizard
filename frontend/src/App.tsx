import React from 'react';
import './App.css';
import ProjectForm from './components/ProjectForm';
import { config } from './config';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>Nobl9 Wizard</h1>
          <p className="subtitle">Project Self-Service Portal</p>
          {config.features.enableDebugMode && (
            <div className="debug-info">
              <small>Version: {config.version} | Environment: {config.environment}</small>
            </div>
          )}
        </div>
      </header>
      <main className="App-main">
        <div className="container">
          <div className="welcome-section">
            <h2>Create a New Nobl9 Project</h2>
            <p>
              Use this wizard to create a new project and assign user roles. 
              All projects will be created in your Nobl9 organization with the specified permissions.
            </p>
            <div className="help-link">
              <a href={config.helpUrl} target="_blank" rel="noopener noreferrer">
                📖 View Nobl9 Documentation
              </a>
            </div>
          </div>
          <ProjectForm />
        </div>
      </main>
      <footer className="App-footer">
        <div className="footer-content">
          <p>&copy; 2024 Nobl9 Wizard. Built for Nobl9 project management.</p>
          {config.features.enableDebugMode && (
            <p className="debug-footer">
              <small>API Endpoint: {config.apiEndpoint}</small>
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App; 