import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { GenerationOutcome, GenerationSpecification } from '../models/generation.model';
import { BackendGenerationService } from '../services/backend-generation.service';
import { ATTEMPT_RECOVERY, AttemptLookup, AttemptRecovery } from '../services/generation-ports';
import { WorkspaceStorageService } from '../services/workspace-storage.service';
import { WorkspaceModule } from '../workspace.module';
import { GenerationPanelComponent, RESTORED_ATTEMPT_MESSAGE } from './generation-panel.component';

describe('GenerationPanelComponent (mocked generation service)', () => {
  let fixture: ComponentFixture<GenerationPanelComponent>;
  let component: GenerationPanelComponent;
  let responses: Subject<GenerationOutcome>[];
  let generation: { generate: ReturnType<typeof vi.fn>; getRun: ReturnType<typeof vi.fn> };
  let recovery: AttemptRecovery;

  async function setUp(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [WorkspaceModule],
      providers: [
        provideRouter([]),
        { provide: BackendGenerationService, useValue: generation },
        { provide: ATTEMPT_RECOVERY, useValue: recovery }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GenerationPanelComponent);
    component = fixture.componentInstance;
    component.pageId = 'page-9';
    component.specification = specification();
    fixture.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    responses = [];
    generation = {
      generate: vi.fn(() => {
        const response = new Subject<GenerationOutcome>();
        responses.push(response);
        return response;
      }),
      // Run details are covered by RunResultComponent; keep them pending here.
      getRun: vi.fn(() => new Observable(() => undefined))
    };
    recovery = { available: false, findRun: vi.fn() };
  });

  afterEach(() => vi.useRealTimers());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  }

  function resolve(outcome: GenerationOutcome, index = responses.length - 1): void {
    responses[index].next(outcome);
    responses[index].complete();
    fixture.detectChanges();
  }

  it('sends one request with a fresh attempt ID however often Generate is clicked', async () => {
    await setUp();

    component.generate();
    component.generate();
    fixture.detectChanges();
    button('Generating')?.click();

    expect(generation.generate).toHaveBeenCalledOnce();
    const request = generation.generate.mock.calls[0][0];
    expect(request).toEqual({ pageId: 'page-9', specification: specification(), attemptId: expect.any(String) });
    expect(request.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(host().textContent).toContain(request.attemptId);
  });

  it('does not resend or invent a new attempt after an unknown outcome', async () => {
    await setUp();
    vi.useFakeTimers();

    component.generate();
    resolve({ kind: 'unknown', message: 'The connection ended before the server confirmed the result.' });
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(generation.generate).toHaveBeenCalledOnce();
    expect(host().textContent).toContain('Outcome unknown');
    expect(button('Generate backend')?.disabled).toBe(true);
    expect(button('Retry with the same attempt ID')).toBeDefined();
    expect(button('Start a new attempt')).toBeDefined();
  });

  it('retries with exactly the original request and attempt ID', async () => {
    await setUp();
    component.generate();
    const original = JSON.stringify(generation.generate.mock.calls[0][0]);
    resolve({ kind: 'unknown', message: 'Lost connection.' });

    component.specification = { ...specification(), basePackage: 'com.example.changed' };
    fixture.detectChanges();
    expect(host().textContent).toContain('The retry sends the original request, not your current specification.');
    button('Retry with the same attempt ID')?.click();

    expect(generation.generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(generation.generate.mock.calls[1][0])).toBe(original);
  });

  it('creates a new attempt ID only when the user starts a new attempt', async () => {
    await setUp();
    component.generate();
    const first = generation.generate.mock.calls[0][0].attemptId;
    resolve({ kind: 'attempt-unavailable', message: 'attemptId: already reserved or terminal; use a new ID' });

    expect(button('Retry with the same attempt ID')).toBeUndefined();
    button('Start a new attempt')?.click();

    expect(generation.generate).toHaveBeenCalledTimes(2);
    expect(generation.generate.mock.calls[1][0].attemptId).not.toBe(first);
  });

  it('restores an unconfirmed attempt after a reload instead of starting over', async () => {
    new WorkspaceStorageService().writeAttempt({
      attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11', pageId: 'page-9',
      requestJson: JSON.stringify({ pageId: 'page-9', specification: specification(), attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11' }),
      submittedAt: '2026-10-19T10:00:00.000Z'
    });
    await setUp();

    expect(host().textContent).toContain(RESTORED_ATTEMPT_MESSAGE);
    expect(host().textContent).toContain('1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11');
    expect(generation.generate).not.toHaveBeenCalled();

    button('Retry with the same attempt ID')?.click();
    expect(generation.generate.mock.calls[0][0].attemptId).toBe('1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11');
  });

  it('clears the stored attempt once the server settles it', async () => {
    await setUp();
    component.generate();
    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).not.toBeNull();

    resolve({ kind: 'rejected', message: 'Invalid generation request', errors: { _global: 'specification.basePackage: invalid Java package' }, tracking: null });

    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).toBeNull();
    expect(host().textContent).toContain('specification.basePackage: invalid Java package');
    expect(button('Generate backend')?.disabled).toBe(false);
  });

  it('reports a recorded failure with its stage and code, without offering files', async () => {
    await setUp();
    component.generate();
    resolve({ kind: 'failed', message: 'Generation attempt failed', tracking: { runId: 'run-7', stage: 'AI', code: 'MODEL_COMPILATION_FAILED' } });

    expect(host().textContent).toContain('Generation failed at stage AI (MODEL_COMPILATION_FAILED)');
    expect(generation.getRun).toHaveBeenCalledWith('run-7');
  });

  it('explains a forbidden request', async () => {
    await setUp();
    component.generate();
    resolve({ kind: 'forbidden', message: 'Access denied' });

    expect(host().textContent).toContain('Access denied');
    expect(host().textContent).toContain('needs access to this page');
  });

  it('cannot generate while blocked', async () => {
    await setUp();
    component.blockedReason = 'Save or discard your metadata changes first.';
    fixture.detectChanges();

    expect(button('Generate backend')?.disabled).toBe(true);
    component.generate();
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('checks the attempt through the recovery port only when it is available', async () => {
    recovery = { available: true, findRun: vi.fn((): Observable<AttemptLookup> => of({ kind: 'not-found' })) };
    await setUp();
    component.generate();
    resolve({ kind: 'unknown', message: 'Lost connection.' });

    button('Check attempt status')?.click();
    fixture.detectChanges();

    expect(recovery.findRun).toHaveBeenCalledWith(generation.generate.mock.calls[0][0].attemptId);
    expect(host().textContent).toContain('the original request never started');
    expect(generation.generate).toHaveBeenCalledOnce();
  });
});

function specification(): GenerationSpecification {
  return {
    specVersion: '1.0.0', basePackage: 'com.example.inventory',
    entity: { className: 'StockUnit', tableName: 'stock_unit', fields: [], enversAudited: false },
    openApi: { contractId: 'stock-unit-api', contractVersion: '3.0.0', bindingOperations: {} },
    operationRoles: {},
    angular: { className: 'StockUnit', tableColumns: {} }
  };
}
