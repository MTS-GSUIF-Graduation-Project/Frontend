export interface PagedBody<T> {
  data: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

export interface Page {
  id: string;
  projectId: string;
  name: string;
  route: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}

/** `POST /api/v1/projects` body (backend `CreateProjectRequest`). */
export interface CreateProjectRequest {
  name: string;
  description: string | null;
}

/** `POST /api/v1/projects/{projectId}/pages` body (backend `CreatePageRequest`). */
export interface CreatePageRequest {
  name: string;
  route: string | null;
}

export interface MetadataVersion {
  id: string;
  pageId: string;
  projectId: string;
  version: number;
  schemaVersion: string;
  isCurrent: boolean;
  snapshot: unknown;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
}
