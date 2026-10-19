import { Component, inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { CreateForm, trimmedMaxLength, trimmedRequired } from '../create-form/create-form';
import { Project } from '../models/browser.model';
import { CreateOutcome, ProjectWriteService } from '../services/project-write.service';

type ProjectFields = { name: FormControl<string>; description: FormControl<string> };

@Component({
  selector: 'app-project-create',
  standalone: false,
  templateUrl: './project-create.component.html',
  styleUrls: ['../projects.shared.css', '../create-form/create-form.css']
})
export class ProjectCreateComponent extends CreateForm<Project, ProjectFields> {
  readonly noun = 'project';
  readonly form = new FormGroup<ProjectFields>({
    name: new FormControl('', { nonNullable: true, validators: [trimmedRequired, trimmedMaxLength(200)] }),
    description: new FormControl('', { nonNullable: true })
  });

  private readonly writer = inject(ProjectWriteService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected draftContext(): string {
    return 'project-create';
  }

  protected send(values: Record<keyof ProjectFields, string>): Observable<CreateOutcome<Project>> {
    return this.writer.createProject({ name: values.name, description: values.description || null });
  }

  protected findExisting(values: Record<keyof ProjectFields, string>): Observable<Project | null> {
    return this.writer.findRecentProject(values.name);
  }

  protected created(project: Project): void {
    this.notifications.show(`Project "${project.name}" created.`);
    void this.router.navigate(project.id ? ['/projects', project.id] : ['/projects']);
  }
}
