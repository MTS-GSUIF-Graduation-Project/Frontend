import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { FailedRunDetails, RunDetails } from '../models/generation.model';
import { BackendGenerationService } from '../services/backend-generation.service';
import { FileSaverService } from '../services/file-saver.service';
import { PACKAGE_DOWNLOAD, PackageDownload } from '../services/generation-ports';
import { WorkspaceModule } from '../workspace.module';
import { RunResultComponent } from './run-result.component';

describe('RunResultComponent (mocked generation service)', () => {
  let fixture: ComponentFixture<RunResultComponent>;
  let generation: {
    getRun: ReturnType<typeof vi.fn>;
    getFailure: ReturnType<typeof vi.fn>;
    readArtifactText: ReturnType<typeof vi.fn>;
    downloadArtifact: ReturnType<typeof vi.fn>;
  };
  let saver: { save: ReturnType<typeof vi.fn> };
  let zip: PackageDownload;

  async function render(run: RunDetails): Promise<void> {
    generation.getRun.mockReturnValue(of(run));
    await TestBed.configureTestingModule({
      imports: [WorkspaceModule],
      providers: [
        provideRouter([]),
        { provide: BackendGenerationService, useValue: generation },
        { provide: FileSaverService, useValue: saver },
        { provide: PACKAGE_DOWNLOAD, useValue: zip }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RunResultComponent);
    fixture.componentRef.setInput('runId', run.id);
    fixture.detectChanges();
  }

  beforeEach(() => {
    generation = {
      getRun: vi.fn(), getFailure: vi.fn(() => of(failure('AI', 'MODEL_OUTPUT_INVALID'))),
      readArtifactText: vi.fn(), downloadArtifact: vi.fn()
    };
    saver = { save: vi.fn() };
    zip = { available: false, downloadZip: vi.fn() };
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find(item => item.textContent?.trim() === label);
  }

  it('shows the run identity, contract, manifest and the server-reported validation scope', async () => {
    await render(successfulRun());

    for (const value of ['Succeeded', 'run-7', 'version-3', 'stock-unit-api 3.0.0', 'abc123', 'ISOLATED_BACKEND_BUILD_PASSED']) {
      expect(text()).toContain(value);
    }
    expect(text()).toContain('not a runtime or production acceptance result');
    expect(text()).toContain('backend/pom.xml');
  });

  it('offers no files for a run that is not a committed successful package', async () => {
    for (const status of ['FAILED', 'IN_PROGRESS', 'INTERRUPTED', 'BUILD_FAILED']) {
      TestBed.resetTestingModule();
      await render({ ...successfulRun(), status, backendPackage: undefined });

      expect(text()).toContain('appear here only when a backend package was generated and saved successfully');
      expect(button('View')).toBeUndefined();
      expect(button('Download')).toBeUndefined();
      expect(button('Download ZIP')).toBeUndefined();
    }
  });

  it('explains a failed run with the stage and code read from the server', async () => {
    generation.getFailure.mockReturnValue(of(failure('FINAL_VALIDATION', 'RESULT_VALIDATION_FAILED')));
    await render({ ...successfulRun(), status: 'FAILED', backendPackage: undefined });

    expect(generation.getFailure).toHaveBeenCalledWith('run-7');
    const message = (fixture.nativeElement as HTMLElement).querySelector('.failure')?.textContent ?? '';
    expect(message).toContain('The generated backend did not pass its final checks.');
    expect(message).toContain('What you can do:');
    // The main message stays plain; identifiers and codes live in the collapsed technical details.
    for (const hidden of ['FINAL_VALIDATION', 'RESULT_VALIDATION_FAILED', 'run-7', 'attempt-9']) {
      expect(message).not.toContain(hidden);
    }
    const details = (fixture.nativeElement as HTMLElement).querySelector('details.technical') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toContain('Technical details');
    for (const value of ['Final package checks', 'FINAL_VALIDATION', 'RESULT_VALIDATION_FAILED', 'run-7', 'attempt-9', 'version-3']) {
      expect(details.textContent).toContain(value);
    }
  });

  it('explains configuration failures and unknown codes', async () => {
    generation.getFailure.mockReturnValue(of(failure('CONFIG', 'CONFIG_MISSING')));
    await render({ ...successfulRun(), status: 'FAILED', backendPackage: undefined });
    expect(text()).toContain('Server configuration');
    expect(text()).toContain('check the generation setup');

    TestBed.resetTestingModule();
    generation.getFailure.mockReturnValue(of(failure(null, 'SOMETHING_NEW')));
    await render({ ...successfulRun(), status: 'FAILED', backendPackage: undefined });
    expect(text()).toContain('did not give a recognised reason');
  });

  it('offers to reload failure details that could not be loaded', async () => {
    generation.getFailure
      .mockReturnValueOnce(throwError(() => new ApiException(403, 'Access denied', null)))
      .mockReturnValueOnce(of(failure('AI', 'MODEL_UNAVAILABLE')));
    await render({ ...successfulRun(), status: 'FAILED', backendPackage: undefined });
    expect(text()).toContain('Access denied');

    button('Try loading the reason again')?.click();
    fixture.detectChanges();
    expect(generation.getFailure).toHaveBeenCalledTimes(2);
    expect(text()).toContain('MODEL_UNAVAILABLE');
    expect(text()).not.toContain('Access denied');
  });

  it('asks for failure details only for FAILED runs and explains the other states', async () => {
    await render(successfulRun());
    expect(generation.getFailure).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    await render({ ...successfulRun(), status: 'INTERRUPTED', backendPackage: undefined });
    expect(generation.getFailure).not.toHaveBeenCalled();
    expect(text()).toContain('The server stopped before this attempt finished');
  });

  it('renders generated source as text, never as markup', async () => {
    generation.readArtifactText.mockReturnValue(of({ kind: 'text', text: '<script>window.pwned = true</script><b>bold</b>' }));
    await render(successfulRun());

    button('View')?.click();
    fixture.detectChanges();

    const source = (fixture.nativeElement as HTMLElement).querySelector('pre.source');
    expect(source?.textContent).toBe('<script>window.pwned = true</script><b>bold</b>');
    expect(source?.querySelector('script, b')).toBeNull();
    expect(generation.readArtifactText).toHaveBeenCalledWith('run-7', 'backend/pom.xml');
  });

  it('reports binary files instead of decoding them', async () => {
    generation.readArtifactText.mockReturnValue(of({ kind: 'binary' }));
    await render(successfulRun());

    button('View')?.click();
    fixture.detectChanges();

    expect(text()).toContain('This is a binary file');
  });

  it('saves a single file under its registered name', async () => {
    const blob = new Blob(['<project/>']);
    generation.downloadArtifact.mockReturnValue(of(blob));
    await render(successfulRun());

    button('Download')?.click();

    expect(generation.downloadArtifact).toHaveBeenCalledWith('run-7', 'backend/pom.xml');
    expect(saver.save).toHaveBeenCalledWith(blob, 'pom.xml');
  });

  it('shows a download failure', async () => {
    generation.downloadArtifact.mockReturnValue(throwError(() => new ApiException(403, 'Access denied', null)));
    await render(successfulRun());

    button('Download')?.click();
    fixture.detectChanges();

    expect(text()).toContain('Access denied');
    expect(saver.save).not.toHaveBeenCalled();
  });

  it('shows a ZIP download failure and saves nothing', async () => {
    zip = { available: true, downloadZip: vi.fn(() => throwError(() => new ApiException(500, 'The package could not be prepared.', null))) };
    await render(successfulRun());

    button('Download ZIP')?.click();
    fixture.detectChanges();

    expect(text()).toContain('The package could not be prepared.');
    expect(saver.save).not.toHaveBeenCalled();
    expect(button('Download ZIP')?.disabled).toBe(false);
  });

  it('downloads the ZIP through the package port when it is available', async () => {
    const blob = new Blob(['PK']);
    zip = { available: true, downloadZip: vi.fn(() => of({ blob, fileName: 'run-7.zip' })) };
    await render(successfulRun());

    button('Download ZIP')?.click();

    expect(zip.downloadZip).toHaveBeenCalledWith('run-7');
    expect(saver.save).toHaveBeenCalledWith(blob, 'run-7.zip');
  });
});

function successfulRun(): RunDetails {
  return {
    id: 'run-7', status: 'SUCCESS', createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:04:00Z',
    metadataVersionId: 'version-3',
    artifacts: [{ id: 'a-1', artifactName: 'pom.xml', artifactType: 'BUILD', relativePath: 'backend/pom.xml', templateVersion: '1' }],
    compileExitCode: null, compileOutput: null, testExitCode: null, testOutput: null,
    validationScope: { passedTargets: [], notValidatedTargets: [] },
    backendPackage: {
      contractId: 'stock-unit-api', contractVersion: '3.0.0', manifestSha256: 'abc123',
      validationScope: { passedTargets: ['ISOLATED_BACKEND_BUILD_PASSED'], notValidatedTargets: [] }
    }
  };
}

function failure(failureStage: string | null, failureCode: string | null): FailedRunDetails {
  return { runId: 'run-7', attemptId: 'attempt-9', metadataVersionId: 'version-3', status: 'FAILED', failureStage, failureCode };
}
