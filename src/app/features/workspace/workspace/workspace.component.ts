import { ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { MetadataVersion, Page } from '../../projects/models/browser.model';
import { MetadataBrowserService } from '../../projects/services/metadata-browser.service';
import { CONFIRM_ACTION, LeaveWarning } from '../../../core/guards/unsaved-changes.guard';
import { GenerationSpecification } from '../models/generation.model';
import { isJsonObject, parseJson } from '../models/json-text';
import { METADATA_STARTERS, MetadataStarter, SUPPORTED_SCHEMA_VERSIONS } from '../models/metadata-starters';
import { CONTRACT_CATALOG, ContractOption } from '../services/generation-ports';
import { WorkspaceMetadataService } from '../services/workspace-metadata.service';
import { WorkspaceStorageService } from '../services/workspace-storage.service';

/** Starting point for the explicit specification; the backend accepts only specVersion 1.0.0. */
export const SPECIFICATION_TEMPLATE = JSON.stringify({
  specVersion: '1.0.0',
  basePackage: '',
  entity: { className: '', tableName: '', fields: [], enversAudited: false },
  openApi: { bindingOperations: {} },
  operationRoles: {},
  angular: { className: '', tableColumns: {} }
}, null, 2);

const UNSAVED_METADATA = 'You have unsaved metadata changes. They are kept as a draft in this browser tab only.';
const GENERATION_WAITING = 'A generation request is still waiting for the server. If you leave, this page will not receive its result; the attempt ID is kept so you can check again.';

export function contractKey(option: Pick<ContractOption, 'contractId' | 'contractVersion'>): string {
  return `${option.contractId}@${option.contractVersion}`;
}

@Component({
  selector: 'app-workspace',
  standalone: false,
  templateUrl: './workspace.component.html',
  styleUrl: '../workspace.shared.css'
})
export class WorkspaceComponent implements OnInit, LeaveWarning {
  private readonly route = inject(ActivatedRoute);
  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly pageId = this.route.snapshot.paramMap.get('pageId') ?? '';

  page: Page | null = null;
  current: MetadataVersion | null = null;
  contracts: ContractOption[] = [];
  contractsLoading = false;
  contractsError = '';
  contractNotice = '';
  loading = true;
  loadError = '';

  schemaVersion = '';
  metadataText = '';
  private savedSchemaVersion = '';
  private savedMetadataText = '';
  restoredDraft = false;

  saving = false;
  saveError = '';
  saveFieldErrors: Record<string, string> | null = null;
  saveMessage = '';

  readonly starters = METADATA_STARTERS;
  selectedStarter = '';
  starterMessage = '';

  specText = SPECIFICATION_TEMPLATE;
  selectedContract = '';
  specification: GenerationSpecification | null = null;
  specificationProblem: string | null = 'Choose a contract.';

  generationActive = false;

  private readonly browser = inject(MetadataBrowserService);
  private readonly metadata = inject(WorkspaceMetadataService);
  private readonly storage = inject(WorkspaceStorageService);
  private readonly catalog = inject(CONTRACT_CATALOG);
  private readonly confirm = inject(CONFIRM_ACTION);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  get starter(): MetadataStarter | null {
    return this.starters.find(starter => starter.id === this.selectedStarter) ?? null;
  }

  /** Backend-supported versions, plus the current version's own value if it is another one. */
  get schemaVersionOptions(): string[] {
    const saved = this.current?.schemaVersion;
    return saved && !SUPPORTED_SCHEMA_VERSIONS.includes(saved) ? [...SUPPORTED_SCHEMA_VERSIONS, saved] : [...SUPPORTED_SCHEMA_VERSIONS];
  }

  get selectedContractOption(): ContractOption | null {
    return this.contracts.find(option => contractKey(option) === this.selectedContract) ?? null;
  }

  /** Two versions of one API share a title, so the version is always shown. */
  contractLabel(option: ContractOption): string {
    return `${option.label} ${option.contractVersion}`;
  }

  get metadataDirty(): boolean {
    return this.metadataText !== this.savedMetadataText || this.schemaVersion !== this.savedSchemaVersion;
  }

  /** Why "Generate backend" is unavailable, or null when it can be used. */
  get generationBlockedReason(): string | null {
    if (!this.current) {
      return 'Save a metadata version first. Generation uses the page\'s saved current version.';
    }
    if (this.metadataDirty) {
      return 'Save or discard your metadata changes first. Generation uses the saved current version, not the draft.';
    }
    return this.specificationProblem;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = '';
    forkJoin({
      page: this.browser.getPage(this.projectId, this.pageId),
      current: this.metadata.getCurrent(this.pageId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ page, current }) => {
        this.page = page;
        this.applySaved(current);
        this.restoreDraft();
        this.refreshSpecification();
        this.loading = false;
        this.changeDetector.detectChanges();
        this.loadContracts();
      },
      error: error => {
        this.loadError = error instanceof ApiException ? error.clientMessage : 'Unable to load the workspace.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  /** Loaded on its own so a catalog failure never blocks metadata editing. */
  loadContracts(): void {
    this.contractsLoading = true;
    this.contractsError = '';
    this.catalog.listBackendContracts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: contracts => {
        this.contracts = contracts;
        this.contractsLoading = false;
        if (this.selectedContract && !this.selectedContractOption) {
          this.contractNotice = `The previously selected contract ${this.selectedContract.replace('@', ' ')} is no longer offered by the server. Choose another.`;
          this.selectedContract = '';
          this.persistDraft();
        }
        this.refreshSpecification();
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.contracts = [];
        this.contractsLoading = false;
        this.contractsError = error instanceof ApiException ? error.clientMessage : 'Unable to load the available contracts.';
        this.refreshSpecification();
        this.changeDetector.detectChanges();
      }
    });
  }

  onMetadataChange(text: string): void {
    this.metadataText = text;
    this.saveMessage = '';
    this.persistDraft();
  }

  onSchemaVersionChange(value: string): void {
    this.schemaVersion = value;
    this.saveMessage = '';
    this.persistDraft();
  }

  onSpecChange(text: string): void {
    this.specText = text;
    this.refreshSpecification();
    this.persistDraft();
  }

  onContractChange(key: string): void {
    this.selectedContract = key;
    this.contractNotice = '';
    this.refreshSpecification();
    this.persistDraft();
  }

  /** Fills the editor from the chosen starter. It never saves; that stays an explicit action. */
  insertStarter(): void {
    const starter = this.starter;
    if (!starter || this.saving) {
      return;
    }
    if (this.schemaVersion && !starter.schemaVersions.includes(this.schemaVersion)) {
      this.starterMessage = `This starter supports schema ${starter.schemaVersions.join(', ')}. Choose one of those schema versions first.`;
      return;
    }

    const text = JSON.stringify(starter.snapshot, null, 2);
    if (this.metadataText.trim() && this.metadataText !== text
      && !this.confirm('Replace the editor content with this template? Your current snapshot text will be lost.')) {
      return;
    }

    this.metadataText = text;
    if (!this.schemaVersion) {
      this.schemaVersion = starter.schemaVersions[0];
    }
    this.restoredDraft = false;
    this.saveMessage = '';
    this.starterMessage = `Inserted "${starter.label}" with schema ${this.schemaVersion}. It is not saved yet.`;
    this.persistDraft();
  }

  discardMetadataChanges(): void {
    this.metadataText = this.savedMetadataText;
    this.schemaVersion = this.savedSchemaVersion;
    this.restoredDraft = false;
    this.saveError = '';
    this.saveFieldErrors = null;
    this.persistDraft();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    this.saveError = '';
    this.saveFieldErrors = null;
    this.saveMessage = '';

    const schemaVersion = this.schemaVersion.trim();
    const parsed = parseJson(this.metadataText);
    if (!schemaVersion) {
      this.saveError = 'Enter the metadata schema version.';
      return;
    }
    if (!parsed.ok) {
      this.saveError = parsed.message;
      return;
    }
    if (!isJsonObject(parsed.value)) {
      this.saveError = 'The metadata snapshot must be a JSON object.';
      return;
    }

    this.saving = true;
    this.metadata.createVersion(this.pageId, schemaVersion, parsed.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: version => {
        this.saving = false;
        this.applySaved(version);
        this.restoredDraft = false;
        this.saveMessage = `Version ${version.version} saved. It is now the page's current version.`;
        this.persistDraft();
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.saving = false;
        const exception = error instanceof ApiException ? error : null;
        this.saveError = exception?.clientMessage ?? 'The metadata version could not be saved.';
        this.saveFieldErrors = exception?.errors ?? null;
        this.changeDetector.detectChanges();
      }
    });
  }

  leaveWarning(): string | null {
    if (this.generationActive) {
      return GENERATION_WAITING;
    }
    return this.metadataDirty ? UNSAVED_METADATA : null;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.leaveWarning()) {
      event.preventDefault();
    }
  }

  private applySaved(version: MetadataVersion | null): void {
    this.current = version;
    this.savedSchemaVersion = version?.schemaVersion ?? '';
    this.savedMetadataText = version ? JSON.stringify(version.snapshot, null, 2) : '';
    this.schemaVersion = this.savedSchemaVersion;
    this.metadataText = this.savedMetadataText;
  }

  private restoreDraft(): void {
    const draft = this.storage.readDraft(this.pageId);
    if (!draft) {
      return;
    }
    this.specText = draft.specText;
    this.selectedContract = draft.contractKey ?? '';
    // A metadata draft started from another version is stale; keep only the spec.
    if (draft.baseVersionId === (this.current?.id ?? null)) {
      this.schemaVersion = draft.schemaVersion;
      this.metadataText = draft.metadataText;
      this.restoredDraft = this.metadataDirty;
    }
  }

  private persistDraft(): void {
    this.storage.writeDraft(this.pageId, {
      schemaVersion: this.schemaVersion,
      metadataText: this.metadataText,
      specText: this.specText,
      contractKey: this.selectedContract || null,
      baseVersionId: this.current?.id ?? null
    });
  }

  private refreshSpecification(): void {
    this.specification = null;
    const contract = this.selectedContractOption;
    if (!contract) {
      this.specificationProblem = this.contractsError
        ? 'The available contracts could not be loaded. Try again before generating.'
        : 'Choose a contract.';
      return;
    }

    const parsed = parseJson(this.specText);
    if (!parsed.ok) {
      this.specificationProblem = `Fix the specification JSON. ${parsed.message}`;
      return;
    }
    if (!isJsonObject(parsed.value)) {
      this.specificationProblem = 'The specification must be a JSON object.';
      return;
    }

    // The selected contract is authoritative; the backend validates everything else.
    const openApi = isJsonObject(parsed.value['openApi']) ? parsed.value['openApi'] : {};
    this.specification = {
      ...parsed.value,
      openApi: { ...openApi, contractId: contract.contractId, contractVersion: contract.contractVersion }
    } as unknown as GenerationSpecification;
    this.specificationProblem = null;
  }
}
