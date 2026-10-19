import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Project } from '../models/browser.model';
import { ProjectsModule } from '../projects.module';
import { CreateOutcome, ProjectWriteService } from '../services/project-write.service';
import { ProjectCreateComponent } from './project-create.component';

describe('ProjectCreateComponent (mocked write service)', () => {
  let fixture: ComponentFixture<ProjectCreateComponent>;
  let responses: Subject<CreateOutcome<Project>>[];
  let writer: { createProject: ReturnType<typeof vi.fn>; findRecentProject: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let username: string;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectWriteService, useValue: writer },
        { provide: AuthService, useValue: { getUsername: () => username, isLoggedIn: () => true } }
      ]
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    fixture = TestBed.createComponent(ProjectCreateComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    username = 'ada';
    responses = [];
    writer = {
      createProject: vi.fn(() => {
        const response = new Subject<CreateOutcome<Project>>();
        responses.push(response);
        return response;
      }),
      findRecentProject: vi.fn()
    };
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  }

  function type(selector: string, value: string): void {
    const field = host().querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    button('Create project')?.click();
    fixture.detectChanges();
  }

  function resolve(outcome: CreateOutcome<Project>): void {
    const response = responses[responses.length - 1];
    response.next(outcome);
    response.complete();
    fixture.detectChanges();
  }

  it('requires a name that is not blank and at most 200 characters after trimming', async () => {
    await render();

    submit();
    expect(host().textContent).toContain('This field is required.');

    type('#project-name', '   ');
    submit();
    expect(host().textContent).toContain('This field is required.');

    type('#project-name', ` ${'a'.repeat(201)} `);
    submit();
    expect(host().textContent).toContain('Use at most 200 characters.');
    expect(writer.createProject).not.toHaveBeenCalled();
  });

  it('sends one trimmed request however often Create is clicked', async () => {
    await render();
    type('#project-name', '  Orders  ');

    submit();
    submit();
    button('Creating')?.click();

    expect(writer.createProject).toHaveBeenCalledOnce();
    expect(writer.createProject).toHaveBeenCalledWith({ name: 'Orders', description: null });
  });

  it('opens the new project, announces it and clears the draft', async () => {
    await render();
    const show = vi.spyOn(TestBed.inject(NotificationService), 'show');
    type('#project-name', 'Orders');
    type('#project-description', 'Order pages');
    expect(sessionStorage.getItem('gsuif.form-draft.ada.project-create')).not.toBeNull();

    submit();
    resolve({ kind: 'created', value: project() });

    expect(writer.createProject).toHaveBeenCalledWith({ name: 'Orders', description: 'Order pages' });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'project-1']);
    expect(show).toHaveBeenCalledWith('Project "Orders" created.');
    expect(sessionStorage.getItem('gsuif.form-draft.ada.project-create')).toBeNull();
    expect(fixture.componentInstance.leaveWarning()).toBeNull();
  });

  it('shows a duplicate name on the name field and keeps the input', async () => {
    await render();
    type('#project-name', 'Orders');

    submit();
    resolve({ kind: 'invalid', message: "Project with name 'Orders' already exists", fieldErrors: { name: "Project with name 'Orders' already exists" } });

    expect(host().querySelector('#project-name-error')?.textContent).toContain("Project with name 'Orders' already exists");
    expect((host().querySelector('#project-name') as HTMLInputElement).value).toBe('Orders');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a permission denial from the server', async () => {
    await render();
    type('#project-name', 'Orders');

    submit();
    resolve({ kind: 'forbidden', message: 'Access denied' });

    expect(host().textContent).toContain('Access denied Your account is not allowed to create this project.');
    expect(button('Create project')?.disabled).toBe(false);
  });

  it('does not resubmit after an unknown outcome until the user explicitly chooses to', async () => {
    await render();
    type('#project-name', 'Orders');

    submit();
    resolve({ kind: 'unknown', message: 'The server did not confirm the result. It may or may not have been created.' });

    expect(host().textContent).toContain('It may or may not have been created.');
    expect(button('Create project')).toBeUndefined();
    expect(writer.createProject).toHaveBeenCalledOnce();

    button('Submit again')?.click();
    fixture.detectChanges();
    expect(writer.createProject).toHaveBeenCalledTimes(2);
  });

  it('checks whether the project exists with a read-only lookup and offers to open it', async () => {
    writer.findRecentProject.mockReturnValue(of(project()));
    await render();
    type('#project-name', 'Orders');
    submit();
    resolve({ kind: 'unknown', message: 'Unknown.' });

    button('Check whether it was created')?.click();
    fixture.detectChanges();

    expect(writer.findRecentProject).toHaveBeenCalledWith('Orders');
    expect(host().textContent).toContain('not that your request created it');
    expect(writer.createProject).toHaveBeenCalledOnce();

    button('Open "Orders"')?.click();
    expect(navigate).toHaveBeenCalledWith(['/projects', 'project-1']);
  });

  it('restores a draft only for the same signed-in user', async () => {
    sessionStorage.setItem('gsuif.form-draft.ada.project-create', JSON.stringify({ name: 'Draft name', description: '' }));
    sessionStorage.setItem('gsuif.form-draft.grace.project-create', JSON.stringify({ name: 'Other user', description: '' }));
    await render();

    expect((host().querySelector('#project-name') as HTMLInputElement).value).toBe('Draft name');
    expect(host().textContent).toContain('Restored your unsaved draft');
  });

  it('warns before leaving with unsaved input', async () => {
    await render();
    expect(fixture.componentInstance.leaveWarning()).toBeNull();

    type('#project-name', 'Orders');

    expect(fixture.componentInstance.leaveWarning()).toContain('unsaved input');
  });
});

function project(): Project {
  return {
    id: 'project-1', name: 'Orders', description: 'Order pages', createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z', createdBy: 'ada', lastModifiedBy: 'ada'
  };
}
