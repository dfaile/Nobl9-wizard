import React, { useState } from 'react';
import './ProjectForm.css';
import { config, api } from '../config';

// Valid Nobl9 project roles
const ROLE_OPTIONS = [
  { label: 'Owner', value: 'project-owner', description: 'Full access to project resources' },
  { label: 'Editor', value: 'project-editor', description: 'Can modify project resources' },
  { label: 'Viewer', value: 'project-viewer', description: 'Read-only access to project' },
];

interface UserGroup {
  userIds: string; // comma-separated
  role: string;    // backend value
}

interface ApiResponse {
  success: boolean;
  message: string;
}

const ProjectForm: React.FC = () => {
  const [appID, setAppID] = useState('');
  const [description, setDescription] = useState('');
  const [userGroups, setUserGroups] = useState<UserGroup[]>([
    { userIds: '', role: ROLE_OPTIONS[0].value },
  ]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Helper to count total users
  const totalUsers = userGroups.reduce((acc, group) => {
    const ids = group.userIds.split(',').map(id => id.trim()).filter(Boolean);
    return acc + ids.length;
  }, 0);

  // Handlers for user group changes
  const handleUserGroupChange = (idx: number, field: keyof UserGroup, value: string) => {
    const updated = [...userGroups];
    updated[idx][field] = value;
    setUserGroups(updated);
  };

  const handleAddGroup = () => {
    if (totalUsers < config.maxUsersPerProject) {
      setUserGroups([...userGroups, { userIds: '', role: ROLE_OPTIONS[0].value }]);
    }
  };

  const handleRemoveGroup = (idx: number) => {
    if (userGroups.length > 1) {
      setUserGroups(userGroups.filter((_, i) => i !== idx));
    }
  };

  // Validation
  const validate = (): string | null => {
    if (!appID.trim()) return 'Project name is required.';
    if (!/^[a-z0-9-]+$/.test(appID)) {
      return 'Project name can only contain lowercase letters, numbers, and hyphens.';
    }
    if (appID.length < 3) return 'Project name must be at least 3 characters long.';
    if (appID.length > 63) return 'Project name must be less than 63 characters.';
    
    if (totalUsers === 0) return 'At least one user must be specified.';
    if (totalUsers > config.maxUsersPerProject) {
      return `Maximum ${config.maxUsersPerProject} users allowed per project.`;
    }
    
    for (const group of userGroups) {
      if (!group.userIds.trim()) return 'User IDs cannot be empty.';
      if (!group.role) return 'Role must be selected for each group.';
      
      // Validate email format for each user
      const userIds = group.userIds.split(',').map(id => id.trim()).filter(Boolean);
      for (const userId of userIds) {
        if (userId.includes('@')) {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(userId)) {
            return `Invalid email format: ${userId}`;
          }
        } else if (userId.length < 2) {
          return `User ID too short: ${userId}`;
        }
      }
    }
    
    return null;
  };

  // Show summary before submit
  const handleShowSummary = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    setShowSummary(true);
    setStatus('idle');
    setMessage('');
  };

  // Final submit to API Gateway
  const handleSubmit = async () => {
    setStatus('loading');
    setMessage('');
    
    try {
      const response = await api.call(api.createProject, {
        method: 'POST',
        body: JSON.stringify({ 
          appID, 
          description, 
          userGroups 
        }),
      });
      
      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        // Reset form after success
        setTimeout(() => {
          setShowSummary(false);
          setAppID('');
          setDescription('');
          setUserGroups([{ userIds: '', role: ROLE_OPTIONS[0].value }]);
          setStatus('idle');
          setMessage('');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Unknown error occurred');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Failed to connect to the server. Please check your connection and try again.');
      console.error('API Error:', err);
    }
  };

  return (
    <div className="project-form fade-in">
      <form onSubmit={handleShowSummary} className="form-container">
        <div className="form-group">
          <label htmlFor="appID">
            Project Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="appID"
            value={appID}
            onChange={e => setAppID(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            title="Only lowercase letters, numbers, and hyphens allowed"
            placeholder="my-project-name"
            className="form-input"
          />
          <small className="form-help">
            Use lowercase letters, numbers, and hyphens only. 3-63 characters.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Enter a description for the project (optional)"
            className="form-textarea"
          />
          <small className="form-help">
            Optional description to help identify the project purpose.
          </small>
        </div>

        <div className="form-group">
          <label>
            Users and Roles <span className="required">*</span>
          </label>
          <div className="user-groups-container">
            {userGroups.map((group, idx) => (
              <div key={idx} className="user-group-row">
                <div className="user-input-container">
                  <input
                    type="text"
                    value={group.userIds}
                    onChange={e => handleUserGroupChange(idx, 'userIds', e.target.value)}
                    required
                    placeholder="user@example.com, another@example.com"
                    className="form-input user-input"
                  />
                  <small className="form-help">
                    Enter email addresses or user IDs, separated by commas
                  </small>
                </div>
                <div className="role-select-container">
                  <select
                    value={group.role}
                    onChange={e => handleUserGroupChange(idx, 'role', e.target.value)}
                    required
                    className="form-select"
                  >
                    {ROLE_OPTIONS.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <small className="form-help">
                    {ROLE_OPTIONS.find(r => r.value === group.role)?.description}
                  </small>
                </div>
                {userGroups.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveGroup(idx)} 
                    className="remove-btn"
                    aria-label="Remove user group"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button 
            type="button" 
            onClick={handleAddGroup} 
            disabled={totalUsers >= config.maxUsersPerProject} 
            className="add-btn"
          >
            + Add Another User Group
          </button>
          
          <div className="user-count">
            Total users: {totalUsers} / {config.maxUsersPerProject}
          </div>
        </div>

        {message && (
          <div className={`message ${status}`}>
            {message}
          </div>
        )}

        <button 
          type="submit" 
          className="submit-btn"
          disabled={status === 'loading'}
        >
          Review & Submit
        </button>
      </form>

      {/* Summary Modal */}
      {showSummary && (
        <div className="summary-modal">
          <div className="summary-card slide-up">
            <h3>Confirm Project Details</h3>
            
            <div className="summary-section">
              <span className="summary-label">Project Name:</span>
              <span className="summary-value">{appID}</span>
            </div>
            
            <div className="summary-section">
              <span className="summary-label">Description:</span>
              <span className="summary-value">
                {description || <em>No description provided</em>}
              </span>
            </div>
            
            <div className="summary-section">
              <span className="summary-label">Users & Roles:</span>
              <ul className="summary-users">
                {userGroups.map((group, idx) => (
                  <li key={idx} className="summary-user-item">
                    <span className="summary-user-list">{group.userIds}</span>
                    <span className="summary-role">
                      Role: {ROLE_OPTIONS.find(r => r.value === group.role)?.label || group.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {message && (
              <div className={`message ${status}`}>
                {message}
              </div>
            )}

            <div className="summary-actions">
              <button 
                onClick={handleSubmit} 
                className="confirm-btn" 
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Creating Project...' : 'Create Project'}
              </button>
              <button 
                onClick={() => setShowSummary(false)} 
                className="cancel-btn" 
                disabled={status === 'loading'}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectForm; 