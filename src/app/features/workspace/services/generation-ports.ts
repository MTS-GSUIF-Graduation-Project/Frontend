import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpAttemptRecovery, HttpContractCatalog, HttpPackageDownload } from './generation-adapters';

/*
 * Ports for contract discovery, attempt lookup and package download. Components depend
 * only on these; the default providers are the HTTP adapters for the endpoints merged on
 * gsuif-backend develop (1d18ade6e5a78f1d066769c4084c711ea66ded8d, PR #49).
 */

export interface ContractOption {
  contractId: string;
  contractVersion: string;
  label: string;
  operationIds: string[];
  /** Contract-level eligibility only; the page and specification are checked during generation. */
  pageCompatibilityChecked: boolean;
}

export interface ContractCatalog {
  listBackendContracts(): Observable<ContractOption[]>;
}

export const CONTRACT_CATALOG = new InjectionToken<ContractCatalog>('CONTRACT_CATALOG', {
  providedIn: 'root',
  factory: () => inject(HttpContractCatalog)
});

/** Result of looking up a generation attempt by its client-chosen ID. */
export type AttemptLookup =
  | {
    kind: 'found';
    runId: string;
    status: string;
    metadataVersionId: string;
    failureStage: string | null;
    failureCode: string | null;
  }
  /** No accessible persisted attempt right now. This does not prove it can never be reserved. */
  | { kind: 'not-found' };

export interface AttemptRecovery {
  readonly available: boolean;
  findRun(attemptId: string): Observable<AttemptLookup>;
}

export const ATTEMPT_RECOVERY = new InjectionToken<AttemptRecovery>('ATTEMPT_RECOVERY', {
  providedIn: 'root',
  factory: () => inject(HttpAttemptRecovery)
});

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

export interface PackageDownload {
  readonly available: boolean;
  downloadZip(runId: string): Observable<DownloadedFile>;
}

export const PACKAGE_DOWNLOAD = new InjectionToken<PackageDownload>('PACKAGE_DOWNLOAD', {
  providedIn: 'root',
  factory: () => inject(HttpPackageDownload)
});
