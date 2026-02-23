/**
 * Projects list page
 */

import { useState, useEffect } from 'react';
import { Room } from 'livekit-client';
import { ProjectDawPage } from './ProjectDawPage';
import { listProjects, createProject, type Project } from '../daw/api';

export function ProjectsPage() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const list = await listProjects();
      setProjects(list);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    const name = prompt('Project name:');
    if (!name) return;

    try {
      const project = await createProject(name);
      setProjects([project, ...projects]);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }
  };

  const handleOpenProject = async (projectId: number) => {
    // For MVP, create a Room instance without connecting to LiveKit
    // In production, you'd fetch a token and connect properly
    const newRoom = new Room();
    setRoom(newRoom);
    setCurrentProjectId(projectId.toString());
  };

  const handleBackToProjects = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    setCurrentProjectId(null);
  };

  if (loading) {
    return <div style={{ padding: 20, color: '#fff' }}>Loading projects...</div>;
  }

  // DAW editor view
  if (currentProjectId && room) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '10px 20px',
            background: '#2a2a2a',
            borderBottom: '1px solid #444',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <button
            onClick={handleBackToProjects}
            style={{
              padding: '6px 12px',
              background: '#555',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            ← Back to Projects
          </button>
          <span>Project ID: {currentProjectId}</span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ProjectDawPage projectId={currentProjectId} room={room} />
        </div>
      </div>
    );
  }

  // Projects list view
  return (
    <div style={{ padding: 20, background: '#1a1a1a', minHeight: '100vh', color: '#fff' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1>DAW Projects</h1>
          <button
            onClick={handleCreateProject}
            style={{
              padding: '10px 20px',
              background: '#4a9eff',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            + New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            No projects yet. Click "New Project" to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                style={{
                  padding: 20,
                  background: '#2a2a2a',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid #444',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4a9eff')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#444')}
              >
                <h3 style={{ margin: '0 0 10px 0' }}>{project.name}</h3>
                <div style={{ fontSize: 12, color: '#888' }}>
                  Created: {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
