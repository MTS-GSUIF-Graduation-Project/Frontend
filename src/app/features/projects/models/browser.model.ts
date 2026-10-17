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
