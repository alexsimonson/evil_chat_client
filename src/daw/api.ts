/**
 * API helpers for DAW project endpoints
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface DawSnapshot {
  snapshot: any;
  version: number;
}

export interface SubmitOpsResponse {
  newVersion: number;
  appliedCount: number;
}

export interface Project {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function fetchDawSnapshot(projectId: string): Promise<DawSnapshot> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/daw`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch DAW snapshot: ${response.statusText}`);
  }

  return response.json();
}

export async function submitOps(projectId: string, baseVersion: number, ops: any[]): Promise<SubmitOpsResponse> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/daw/ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ baseVersion, ops }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = `Failed to submit ops: ${response.statusText}${errorData.error ? ` (${errorData.error})` : ''}${errorData.message ? ` - ${errorData.message}` : ''}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function createProject(name: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create project: ${response.statusText}`);
  }

  return response.json();
}

export async function listProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to list projects: ${response.statusText}`);
  }

  return response.json();
}
