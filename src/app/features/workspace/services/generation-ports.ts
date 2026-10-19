import { InjectionToken } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';

/*
 * Integration points whose backend contracts are still pending (SCRUM-65 follow-ups):
 * a contract-listing API, an owner-scoped lookup by attemptId, and a direct package ZIP
 * download. Components depend only on these ports. Replace each default provider with an
 * HTTP adapter once the actual endpoint and DTO are verified; do not guess them here.
 */

export interface ContractOption {
  contractId: string;
  contractVersion: string;
  label: string;
}

export interface ContractCatalog {
  listBackendContracts(): Observable<ContractOption[]>;
}

/**
 * BACKEND-eligible pairs (updateMode FULL) in the production registry
 * `src/main/resources/generation/packaged-contracts.yaml` of gsuif-backend PR #47 at
 * 9482e1fc25f405f0ec7a780b9f39ffbcf0b9bbc4. Legacy-profile entries and test-only
 * contracts under src/test are deliberately absent. Keep this list in step with that
 * registry, and its pinned test with it, until the listing API replaces it.
 */
export const VERIFIED_BACKEND_CONTRACTS: readonly ContractOption[] = [
  { contractId: 'stock-unit-api', contractVersion: '3.0.0', label: 'Stock unit API 3.0.0 (paged)' },
  { contractId: 'stock-unit-api', contractVersion: '2.0.0', label: 'Stock unit API 2.0.0' },
  { contractId: 'asset-ticket-api', contractVersion: '2.0.0', label: 'Asset ticket API 2.0.0' }
];

export class VerifiedContractCatalog implements ContractCatalog {
  listBackendContracts(): Observable<ContractOption[]> {
    return of(VERIFIED_BACKEND_CONTRACTS.map(option => ({ ...option })));
  }
}

export const CONTRACT_CATALOG = new InjectionToken<ContractCatalog>('CONTRACT_CATALOG', {
  providedIn: 'root',
  factory: () => new VerifiedContractCatalog()
});

/** Result of looking up a generation attempt by its client-chosen ID. */
export type AttemptLookup =
  | { kind: 'found'; runId: string }
  | { kind: 'not-found' };

export interface AttemptRecovery {
  /** False until the backend lookup endpoint is integrated. */
  readonly available: boolean;
  findRun(attemptId: string): Observable<AttemptLookup>;
}

export class UnavailableAttemptRecovery implements AttemptRecovery {
  readonly available = false;

  findRun(): Observable<AttemptLookup> {
    return throwError(() => new ApiException(0, 'Attempt lookup is not available yet.', null));
  }
}

export const ATTEMPT_RECOVERY = new InjectionToken<AttemptRecovery>('ATTEMPT_RECOVERY', {
  providedIn: 'root',
  factory: () => new UnavailableAttemptRecovery()
});

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

export interface PackageDownload {
  /** False until the backend direct ZIP endpoint is integrated. */
  readonly available: boolean;
  downloadZip(runId: string): Observable<DownloadedFile>;
}

export class UnavailablePackageDownload implements PackageDownload {
  readonly available = false;

  downloadZip(): Observable<DownloadedFile> {
    return throwError(() => new ApiException(0, 'ZIP download is not available yet.', null));
  }
}

export const PACKAGE_DOWNLOAD = new InjectionToken<PackageDownload>('PACKAGE_DOWNLOAD', {
  providedIn: 'root',
  factory: () => new UnavailablePackageDownload()
});
