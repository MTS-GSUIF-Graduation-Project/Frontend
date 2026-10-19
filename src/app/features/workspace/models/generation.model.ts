/**
 * BACKEND generation shapes, mirroring `GenerationApiDtos` and `GenerationSpecification`
 * in gsuif-backend PR #47 at 9482e1fc25f405f0ec7a780b9f39ffbcf0b9bbc4.
 * These contracts exist only on that PR until it merges into develop.
 */

export type RunStatus = 'SUCCESS' | 'BUILD_FAILED' | 'IN_PROGRESS' | 'FAILED' | 'INTERRUPTED';

export type SupportedRole = 'ROLE_ADMIN' | 'ROLE_USER';

export interface FieldSpec {
  name: string;
  columnName: string;
  javaType: string;
  nullable: boolean;
  columnLength: number | null;
  enumType: string | null;
}

export interface GenerationSpecification {
  specVersion: string;
  basePackage: string;
  entity: { className: string; tableName: string; fields: FieldSpec[]; enversAudited: boolean };
  openApi: { contractId: string; contractVersion: string; bindingOperations: Record<string, string> };
  operationRoles: Record<string, SupportedRole[]>;
  angular: { className: string; tableColumns: Record<string, string[]> };
}

export interface BackendGenerationRequest {
  pageId: string;
  specification: GenerationSpecification;
  attemptId: string;
}

export interface ValidationScope {
  passedTargets: string[];
  notValidatedTargets: string[];
}

export interface BackendPackage {
  contractId: string;
  contractVersion: string;
  manifestSha256: string;
  validationScope: ValidationScope;
}

export interface BackendCreated {
  runId: string;
  attemptId: string;
  status: string;
  metadataVersionId: string;
  artifactCount: number;
  backendPackage: BackendPackage | null;
}

export interface LinkedArtifact {
  id: string;
  artifactName: string;
  artifactType: string;
  relativePath: string;
  templateVersion: string | null;
}

export interface RunDetails {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadataVersionId: string;
  artifacts: LinkedArtifact[];
  compileExitCode: number | null;
  compileOutput: string | null;
  testExitCode: number | null;
  testOutput: string | null;
  validationScope: ValidationScope;
  /** Present only for a committed SUCCESS BACKEND run. */
  backendPackage?: BackendPackage;
}

/** Read from `X-Generation-*` headers, which the server sends only for a persisted failure owned by the caller. */
export interface FailureTracking {
  runId: string;
  stage: string | null;
  code: string | null;
}

/** Every way a BACKEND generation request can end, as far as the client can tell. */
export type GenerationOutcome =
  | { kind: 'success'; result: BackendCreated }
  | { kind: 'rejected'; message: string; errors: Record<string, string> | null; tracking: FailureTracking | null }
  | { kind: 'attempt-unavailable'; message: string }
  | { kind: 'attempt-conflict'; message: string }
  | { kind: 'failed'; message: string; tracking: FailureTracking }
  | { kind: 'forbidden'; message: string }
  | { kind: 'not-found'; message: string }
  | { kind: 'unauthenticated' }
  | { kind: 'unknown'; message: string };

export type ArtifactText =
  | { kind: 'text'; text: string }
  | { kind: 'binary' }
  | { kind: 'too-large'; size: number };
