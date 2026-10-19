/**
 * BACKEND generation shapes, mirroring `GenerationApiDtos` and `GenerationSpecification`
 * on gsuif-backend develop at 1d18ade6e5a78f1d066769c4084c711ea66ded8d (PRs #47 and #49).
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

/** `GET /api/v1/generation/contracts?output=BACKEND` item. */
export interface AvailableContract {
  contractId: string;
  contractVersion: string;
  label: string;
  operationIds: string[];
  updateMode: string;
  /** Always false: eligibility is contract-level; the page is checked during generation. */
  pageCompatibilityChecked: boolean;
}

/** `GET /api/v1/generation/attempts/{attemptId}` body. Failure fields are set only for FAILED. */
export interface AttemptStatus {
  runId: string;
  attemptId: string;
  status: string;
  metadataVersionId: string;
  failureStage: string | null;
  failureCode: string | null;
}

/** Read from `X-Generation-*` headers, which the server sends only for a persisted failure owned by the caller. */
/** `GET /api/v1/generation/runs/{id}/failure`: owner-scoped details of a FAILED run. */
export interface FailedRunDetails {
  runId: string;
  attemptId: string;
  metadataVersionId: string;
  status: string;
  failureStage: string | null;
  failureCode: string | null;
}

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
