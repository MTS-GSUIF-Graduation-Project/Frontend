import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FailedRunDetails, GenerationOutcome, GenerationSpecification, RunDetails } from '../models/generation.model';
import { BackendGenerationService } from '../services/backend-generation.service';
import { ATTEMPT_RECOVERY, AttemptLookup, AttemptRecovery } from '../services/generation-ports';
import { WorkspaceStorageService } from '../services/workspace-storage.service';
import { WorkspaceModule } from '../workspace.module';
import { GenerationPanelComponent, RESTORED_ATTEMPT_MESSAGE } from './generation-panel.component';

describe('GenerationPanelComponent (mocked generation service)', () => {
  let fixture: ComponentFixture<GenerationPanelComponent>;
  let responses: Subject<GenerationOutcome>[];
  let generation: { generate: ReturnType<typeof vi.fn>; getRun: ReturnType<typeof vi.fn>; getFailure: ReturnType<typeof vi.fn> };
  let recovery: AttemptRecovery;
  let username: string;

  async function setUp(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [WorkspaceModule],
      providers: [
        provideRouter([]),
        { provide: BackendGenerationService, useValue: generation },
        { provide: ATTEMPT_RECOVERY, useValue: recovery },
        { provide: AuthService, useValue: { getUsername: () => username } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GenerationPanelComponent);
    fixture.componentRef.setInput('pageId', 'page-9');
    fixture.componentRef.setInput('specification', specification());
    fixture.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    username = 'alice';
    responses = [];
    generation = {
      generate: vi.fn(() => {
        const response = new Subject<GenerationOutcome>();
        responses.push(response);
        return response;
      }),
      // Run details are covered by RunResultComponent; keep them pending here.
      getRun: vi.fn(() => new Observable(() => undefined)),
      getFailure: vi.fn(() => new Observable(() => undefined))
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

  function click(label: string): void {
    const target = button(label);
    expect(target, `button "${label}"`).toBeDefined();
    target?.click();
    fixture.detectChanges();
  }

  function resolve(outcome: GenerationOutcome, index = responses.length - 1): void {
    responses[index].next(outcome);
    responses[index].complete();
    fixture.detectChanges();
  }

  it('sends one request with a fresh attempt ID however often Generate is clicked', async () => {
    await setUp();

    const generate = button('Generate backend');
    generate?.click();
    generate?.click();
    fixture.detectChanges();
    button('Generating')?.click();

    expect(generation.generate).toHaveBeenCalledOnce();
    const request = generation.generate.mock.calls[0][0];
    expect(request).toEqual({ pageId: 'page-9', specification: specification(), attemptId: expect.any(String) });
    expect(request.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(host().textContent).toContain(request.attemptId);
    expect(button('Generating')?.getAttribute('aria-busy')).toBe('true');
    expect(button('Generating')?.disabled).toBe(true);
  });

  it('does not resend or invent a new attempt after an unknown outcome', async () => {
    await setUp();
    vi.useFakeTimers();

    click('Generate backend');
    resolve({ kind: 'unknown', message: 'The connection ended before the server confirmed the result.' });
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(generation.generate).toHaveBeenCalledOnce();
    expect(host().textContent).toContain("We don't know yet whether generation finished");
    expect(button('Generate backend')?.disabled).toBe(true);
    expect(button('Retry with the same attempt ID')).toBeDefined();
    expect(button('Start a new attempt')).toBeDefined();
  });

  it('retries with exactly the original request and attempt ID', async () => {
    await setUp();
    click('Generate backend');
    const original = JSON.stringify(generation.generate.mock.calls[0][0]);
    resolve({ kind: 'unknown', message: 'Lost connection.' });

    fixture.componentRef.setInput('specification', { ...specification(), basePackage: 'com.example.changed' });
    fixture.detectChanges();
    expect(host().textContent).toContain('The retry sends the original request, not your current specification.');
    click('Retry with the same attempt ID');

    expect(generation.generate).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(generation.generate.mock.calls[1][0])).toBe(original);
  });

  it('creates a new attempt ID only when the user starts a new attempt', async () => {
    await setUp();
    click('Generate backend');
    const first = generation.generate.mock.calls[0][0].attemptId;
    resolve({ kind: 'attempt-unavailable', message: 'attemptId: already reserved or terminal; use a new ID' });

    expect(button('Retry with the same attempt ID')).toBeUndefined();
    click('Start a new attempt');

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

    click('Retry with the same attempt ID');
    expect(generation.generate.mock.calls[0][0].attemptId).toBe('1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11');
  });

  it('clears the stored attempt once the server settles it', async () => {
    await setUp();
    click('Generate backend');
    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).not.toBeNull();

    resolve({ kind: 'rejected', message: 'Invalid generation request', errors: { _global: 'specification.basePackage: invalid Java package' }, tracking: null });

    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).toBeNull();
    expect(host().textContent).toContain('specification.basePackage: invalid Java package');
    expect(button('Generate backend')?.disabled).toBe(false);
  });

  it('reports a recorded failure with its stage and code, without offering files', async () => {
    await setUp();
    click('Generate backend');
    resolve({ kind: 'failed', message: 'Generation attempt failed', tracking: { runId: 'run-7', stage: 'AI', code: 'MODEL_COMPILATION_FAILED' } });

    expect(host().textContent).toContain('Generation failed, and no backend was saved.');
    expect(generation.getRun).toHaveBeenCalledWith('run-7');
    expect(TestBed.inject(WorkspaceStorageService).readLastRun('alice', 'page-9')?.runId).toBe('run-7');
  });

  it('keeps a failed run visible after a reload, with its stage, code and explanation read from the server', async () => {
    generation.getRun = vi.fn(() => of(failedRun()));
    generation.getFailure = vi.fn(() => of(failureDetails('FINAL_VALIDATION', 'RESULT_VALIDATION_FAILED')));
    await setUp();
    click('Generate backend');
    resolve({ kind: 'failed', message: 'Generation attempt failed', tracking: { runId: 'run-7', stage: 'FINAL_VALIDATION', code: 'RESULT_VALIDATION_FAILED' } });

    // Reload or revisit: a new component with no pending attempt in this tab.
    TestBed.resetTestingModule();
    sessionStorage.clear();
    generation.getRun.mockClear();
    generation.getFailure.mockClear();
    await setUp();

    expect(generation.getRun).toHaveBeenCalledWith('run-7');
    expect(generation.getFailure).toHaveBeenCalledWith('run-7');
    expect(host().textContent).toContain('Most recent run started from this browser');
    expect(host().textContent).toContain('Final package checks');
    expect(host().textContent).toContain('RESULT_VALIDATION_FAILED');
    expect(host().textContent).toContain('did not pass its final checks');
    expect(generation.generate).toHaveBeenCalledOnce();
    expect(button('Generate backend')?.disabled).toBe(false);
  });

  it("does not show another user's last run from this browser", async () => {
    new WorkspaceStorageService().writeLastRun('bob', 'page-9', 'run-of-bob');
    await setUp();

    expect(generation.getRun).not.toHaveBeenCalled();
    expect(host().textContent).not.toContain('Most recent run');
  });

  it('remembers the run of a successful generation and of a rejected request that was recorded', async () => {
    await setUp();
    click('Generate backend');
    resolve({ kind: 'rejected', message: 'Invalid', errors: null, tracking: { runId: 'run-rejected', stage: 'CONTRACT', code: 'VALIDATION_FAILED' } });
    expect(TestBed.inject(WorkspaceStorageService).readLastRun('alice', 'page-9')?.runId).toBe('run-rejected');
    expect(generation.getRun).toHaveBeenCalledWith('run-rejected');

    click('Generate backend');
    resolve({ kind: 'success', result: { runId: 'run-ok', attemptId: 'a', status: 'SUCCESS', metadataVersionId: 'v', artifactCount: 1, backendPackage: null } });
    expect(TestBed.inject(WorkspaceStorageService).readLastRun('alice', 'page-9')?.runId).toBe('run-ok');
  });

  it('explains a forbidden request', async () => {
    await setUp();
    click('Generate backend');
    resolve({ kind: 'forbidden', message: 'Access denied' });

    expect(host().textContent).toContain('Access denied');
    expect(host().textContent).toContain('You do not have access to generate from this page.');
    expect(host().textContent).toContain('What you can do:');
  });

  it('cannot generate while blocked', async () => {
    await setUp();
    fixture.componentRef.setInput('blockedReason', 'Save or discard your metadata changes first.');
    fixture.detectChanges();

    expect(host().textContent).toContain('Save or discard your metadata changes first.');
    expect(button('Generate backend')?.disabled).toBe(true);
    fixture.componentInstance.generate();
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('checks the attempt through the recovery port only when it is available', async () => {
    recovery = { available: true, findRun: vi.fn((): Observable<AttemptLookup> => of({ kind: 'not-found' })) };
    await setUp();
    click('Generate backend');
    resolve({ kind: 'unknown', message: 'Lost connection.' });

    click('Check attempt status');

    expect(recovery.findRun).toHaveBeenCalledWith(generation.generate.mock.calls[0][0].attemptId);
    expect(host().textContent).toContain('no accessible record of this attempt yet');
    expect(host().textContent).toContain('does not prove it will never start');
    expect(host().textContent).not.toContain('never started');
    expect(button('Retry with the same attempt ID')).toBeDefined();
    expect(generation.generate).toHaveBeenCalledOnce();
  });

  it('looks up a restored attempt once, read-only, and resolves it when the server recorded success', async () => {
    recovery = { available: true, findRun: vi.fn((): Observable<AttemptLookup> => of(found('SUCCESS'))) };
    writeRestoredAttempt();
    vi.useFakeTimers();
    await setUp();
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(recovery.findRun).toHaveBeenCalledOnce();
    expect(recovery.findRun).toHaveBeenCalledWith(RESTORED_ID);
    expect(generation.generate).not.toHaveBeenCalled();
    expect(host().textContent).toContain('The server finished this attempt: it succeeded');
    expect(host().textContent).not.toContain("We don't know yet whether generation finished");
    expect(generation.getRun).toHaveBeenCalledWith('run-7');
    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).toBeNull();
    expect(button('Retry with the same attempt ID')).toBeUndefined();
    expect(button('Generate backend')?.disabled).toBe(false);
  });

  it('keeps an in-progress attempt unresolved and does not poll', async () => {
    recovery = { available: true, findRun: vi.fn((): Observable<AttemptLookup> => of(found('IN_PROGRESS'))) };
    writeRestoredAttempt();
    vi.useFakeTimers();
    await setUp();
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(recovery.findRun).toHaveBeenCalledOnce();
    expect(host().textContent).toContain('still running on the server');
    expect(host().textContent).toContain("We don't know yet whether generation finished");
    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).not.toBeNull();
    expect(button('Generate backend')?.disabled).toBe(true);

    click('Check again');
    expect(recovery.findRun).toHaveBeenCalledTimes(2);
    expect(generation.generate).not.toHaveBeenCalled();
  });

  it('reports a recorded failure found by the lookup with its stage and code', async () => {
    recovery = {
      available: true,
      findRun: vi.fn((): Observable<AttemptLookup> => of({ ...found('FAILED'), failureStage: 'AI', failureCode: 'MODEL_COMPILATION_FAILED' }))
    };
    generation.getRun = vi.fn(() => of(failedRun()));
    generation.getFailure = vi.fn(() => of(failureDetails('AI', 'MODEL_COMPILATION_FAILED')));
    writeRestoredAttempt();
    await setUp();

    expect(host().textContent).toContain('it failed. What happened and what you can do are shown below.');
    expect(host().textContent).toContain('AI generation');
    expect(host().textContent).toContain('MODEL_COMPILATION_FAILED');
    expect(host().textContent).toContain('The AI-written code did not compile.');
    expect(host().textContent).not.toContain("We don't know yet whether generation finished");
    expect(generation.getFailure).toHaveBeenCalledWith('run-7');
    expect(TestBed.inject(WorkspaceStorageService).readLastRun('alice', 'page-9')?.runId).toBe('run-7');
    expect(TestBed.inject(WorkspaceStorageService).readAttempt('page-9')).toBeNull();
    expect(generation.generate).not.toHaveBeenCalled();
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

const RESTORED_ID = '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11';

function writeRestoredAttempt(): void {
  new WorkspaceStorageService().writeAttempt({
    attemptId: RESTORED_ID, pageId: 'page-9',
    requestJson: JSON.stringify({ pageId: 'page-9', specification: specification(), attemptId: RESTORED_ID }),
    submittedAt: '2026-10-19T10:00:00.000Z'
  });
}

function found(status: string): AttemptLookup {
  return { kind: 'found', runId: 'run-7', status, metadataVersionId: 'version-3', failureStage: null, failureCode: null };
}

function failedRun(): RunDetails {
  return {
    id: 'run-7', status: 'FAILED', createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:02:00Z',
    metadataVersionId: 'version-3', artifacts: [], compileExitCode: null, compileOutput: null,
    testExitCode: null, testOutput: null, validationScope: { passedTargets: [], notValidatedTargets: [] }
  };
}

function failureDetails(failureStage: string, failureCode: string): FailedRunDetails {
  return { runId: 'run-7', attemptId: RESTORED_ID, metadataVersionId: 'version-3', status: 'FAILED', failureStage, failureCode };
}
