import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { CONFIRM_ACTION } from '../../../core/guards/unsaved-changes.guard';
import { ApiException } from '../../../core/models/api-response.model';
import { MetadataVersion } from '../../projects/models/browser.model';
import { MetadataBrowserService } from '../../projects/services/metadata-browser.service';
import { BackendGenerationService } from '../services/backend-generation.service';
import { WorkspaceMetadataService } from '../services/workspace-metadata.service';
import { WorkspaceStorageService } from '../services/workspace-storage.service';
import { WorkspaceModule } from '../workspace.module';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent (mocked services)', () => {
  let fixture: ComponentFixture<WorkspaceComponent>;
  let component: WorkspaceComponent;
  let metadata: { getCurrent: ReturnType<typeof vi.fn>; createVersion: ReturnType<typeof vi.fn> };
  let generation: { generate: ReturnType<typeof vi.fn>; getRun: ReturnType<typeof vi.fn> };
  let confirm: ReturnType<typeof vi.fn>;

  async function render(current: MetadataVersion | null = version(3)): Promise<void> {
    metadata.getCurrent.mockReturnValue(of(current));
    await TestBed.configureTestingModule({
      imports: [WorkspaceModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId: 'project-71', pageId: 'page-9' }) } } },
        { provide: MetadataBrowserService, useValue: { getPage: () => of(page()) } },
        { provide: WorkspaceMetadataService, useValue: metadata },
        { provide: BackendGenerationService, useValue: generation },
        { provide: CONFIRM_ACTION, useValue: confirm }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    metadata = { getCurrent: vi.fn(), createVersion: vi.fn() };
    generation = { generate: vi.fn(), getRun: vi.fn(() => new Observable(() => undefined)) };
    confirm = vi.fn(() => true);
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  }

  function type(selector: string, value: string, event = 'input'): void {
    const field = host().querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    field.value = value;
    field.dispatchEvent(new Event(event));
    fixture.detectChanges();
  }

  it('loads the page and its current metadata version into the editor', async () => {
    await render();

    expect(host().textContent).toContain('Dashboard workspace');
    expect(host().textContent).toContain('Current version 3');
    expect((host().querySelector('#metadata-json') as HTMLTextAreaElement).value).toContain('"components"');
    expect((host().querySelector('#schema-version') as HTMLInputElement).value).toBe('1.2.0');
  });

  it('keeps invalid JSON as a draft and does not save it', async () => {
    await render();

    type('#metadata-json', '{"components": [}');
    button('Save as new version')?.click();
    fixture.detectChanges();

    expect(metadata.createVersion).not.toHaveBeenCalled();
    expect(host().textContent).toContain('Invalid JSON: unexpected "}"');
    expect((host().querySelector('#metadata-json') as HTMLTextAreaElement).value).toBe('{"components": [}');
    expect(TestBed.inject(WorkspaceStorageService).readDraft('page-9')?.metadataText).toBe('{"components": [}');
  });

  it('saves a new immutable version and makes it current', async () => {
    metadata.createVersion.mockReturnValue(of(version(4, { components: [{ id: 'c-1' }] })));
    await render();

    type('#metadata-json', '{"components": [{"id": "c-1"}]}');
    button('Save as new version')?.click();
    fixture.detectChanges();

    expect(metadata.createVersion).toHaveBeenCalledWith('page-9', '1.2.0', { components: [{ id: 'c-1' }] });
    expect(host().textContent).toContain('Version 4 saved. It is now the page\'s current version.');
    expect(component.current?.id).toBe('version-4');
    expect(component.metadataDirty).toBe(false);
  });

  it('shows backend validation errors by path and keeps the draft', async () => {
    metadata.createVersion.mockReturnValue(throwError(() =>
      new ApiException(400, 'Request validation failed', { '$.components[0].type': 'must be a known component type' })));
    await render();

    type('#metadata-json', '{"components": [{"type": "unknown"}]}');
    button('Save as new version')?.click();
    fixture.detectChanges();

    expect(host().textContent).toContain('Request validation failed');
    expect(host().textContent).toContain('$.components[0].type');
    expect(host().textContent).toContain('must be a known component type');
    expect(component.metadataDirty).toBe(true);
  });

  it('restores an unsaved draft started from the same current version', async () => {
    new WorkspaceStorageService().writeDraft('page-9', {
      schemaVersion: '1.2.0', metadataText: '{"components": [1]}', specText: '{}',
      contractKey: 'stock-unit-api@3.0.0', baseVersionId: 'version-3'
    });
    await render();

    expect(host().textContent).toContain('Restored your unsaved draft');
    expect(component.metadataText).toBe('{"components": [1]}');
    expect(component.selectedContract).toBe('stock-unit-api@3.0.0');
  });

  it('drops a metadata draft started from an older version', async () => {
    new WorkspaceStorageService().writeDraft('page-9', {
      schemaVersion: '1.2.0', metadataText: '{"stale": true}', specText: '{}', contractKey: null, baseVersionId: 'version-2'
    });
    await render();

    expect(component.metadataText).not.toContain('stale');
    expect(component.metadataDirty).toBe(false);
  });

  it('warns before leaving unsaved metadata', async () => {
    await render();
    expect(component.leaveWarning()).toBeNull();

    type('#metadata-json', '{}');

    expect(component.leaveWarning()).toContain('unsaved metadata changes');
  });

  it('offers only the verified contracts and applies the chosen one to the specification', async () => {
    await render();

    const options = Array.from(host().querySelectorAll('#contract option')).map(option => option.textContent?.trim());
    expect(options).toEqual(['Choose a contract', 'Stock unit API 3.0.0 (paged)', 'Stock unit API 2.0.0', 'Asset ticket API 2.0.0']);
    expect(component.generationBlockedReason).toBe('Choose a contract.');

    type('#contract', 'stock-unit-api@3.0.0', 'change');

    expect(component.generationBlockedReason).toBeNull();
    expect(component.specification?.openApi).toEqual({ bindingOperations: {}, contractId: 'stock-unit-api', contractVersion: '3.0.0' });
  });

  it('overrides contract fields typed into the specification with the selected contract', async () => {
    await render();
    type('#contract', 'asset-ticket-api@2.0.0', 'change');

    type('#specification-json', '{"specVersion": "1.0.0", "openApi": {"contractId": "guessed-api", "contractVersion": "9.9.9"}}');

    expect(component.specification?.openApi.contractId).toBe('asset-ticket-api');
    expect(component.specification?.openApi.contractVersion).toBe('2.0.0');
  });

  it('blocks generation while the specification JSON is invalid', async () => {
    await render();
    type('#contract', 'stock-unit-api@3.0.0', 'change');

    type('#specification-json', '{"specVersion": ');

    expect(component.specification).toBeNull();
    expect(component.generationBlockedReason).toContain('Fix the specification JSON.');
  });

  it('blocks generation from an unsaved metadata draft or a page without a version', async () => {
    await render(null);
    expect(component.generationBlockedReason).toContain('Save a metadata version first');

    TestBed.resetTestingModule();
    await render();
    type('#contract', 'stock-unit-api@3.0.0', 'change');
    type('#metadata-json', '{"components": []} ');

    expect(component.generationBlockedReason).toContain('Save or discard your metadata changes first');
    expect(button('Generate backend')?.disabled).toBe(true);
  });

  it('offers only the backend-supported schema versions', async () => {
    await render(null);

    const options = Array.from(host().querySelectorAll('#schema-version option')).map(option => option.textContent?.trim());
    expect(options).toEqual(['Choose a schema version', '1.0.0', '1.1.0', '1.2.0']);
  });

  it('inserts a starter into an empty page without saving it', async () => {
    await render(null);

    type('#metadata-starter', 'single-text-field', 'change');
    button('Insert into editor')?.click();
    fixture.detectChanges();

    expect(JSON.parse(component.metadataText)).toEqual({
      components: [expect.objectContaining({ type: 'text-field', label: 'Test' })],
      apiBindings: []
    });
    expect(component.schemaVersion).toBe('1.0.0');
    expect(host().textContent).toContain('It is not saved yet.');
    expect(metadata.createVersion).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('saves the inserted starter as version 1 only when the user clicks save', async () => {
    metadata.createVersion.mockReturnValue(of(version(1, { components: [], apiBindings: [] })));
    await render(null);

    type('#metadata-starter', 'empty', 'change');
    button('Insert into editor')?.click();
    fixture.detectChanges();
    expect(metadata.createVersion).not.toHaveBeenCalled();

    button('Save as new version')?.click();
    fixture.detectChanges();

    expect(metadata.createVersion).toHaveBeenCalledOnce();
    expect(metadata.createVersion).toHaveBeenCalledWith('page-9', '1.0.0', { components: [], apiBindings: [] });
    expect(host().textContent).toContain('Version 1 saved.');
  });

  it('asks before replacing existing editor text and keeps it when declined', async () => {
    confirm.mockReturnValue(false);
    await render();

    type('#metadata-starter', 'empty', 'change');
    button('Insert into editor')?.click();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledOnce();
    expect(component.metadataDirty).toBe(false);
  });

  it('refuses a starter that does not support the selected schema version', async () => {
    await render();

    type('#metadata-starter', 'single-text-field', 'change');
    button('Insert into editor')?.click();
    fixture.detectChanges();

    expect(host().textContent).toContain('This starter supports schema 1.0.0. Choose one of those schema versions first.');
    expect(component.metadataDirty).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows a load error with a retry', async () => {
    metadata.getCurrent.mockReturnValue(throwError(() => new ApiException(403, 'Access denied', null)));
    await TestBed.configureTestingModule({
      imports: [WorkspaceModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId: 'project-71', pageId: 'page-9' }) } } },
        { provide: MetadataBrowserService, useValue: { getPage: () => of(page()) } },
        { provide: WorkspaceMetadataService, useValue: metadata },
        { provide: BackendGenerationService, useValue: generation },
        { provide: CONFIRM_ACTION, useValue: confirm }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(WorkspaceComponent);
    fixture.detectChanges();

    expect(host().textContent).toContain('Access denied');
    expect(button('Try again')).toBeDefined();
  });
});

function page() {
  return {
    id: 'page-9', projectId: 'project-71', name: 'Dashboard', route: '/dashboard',
    createdAt: '2026-10-03T08:00:00Z', updatedAt: '2026-10-04T09:00:00Z', createdBy: 'linus', lastModifiedBy: 'margaret'
  };
}

function version(number: number, snapshot: unknown = { components: [] }): MetadataVersion {
  return {
    id: `version-${number}`, pageId: 'page-9', projectId: 'project-71', version: number, schemaVersion: '1.2.0',
    isCurrent: true, snapshot, createdAt: '2026-10-05T08:00:00Z', updatedAt: '2026-10-05T08:00:00Z',
    createdBy: 'barbara', lastModifiedBy: 'barbara'
  };
}
