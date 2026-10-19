import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { SharedModule } from '../../shared/shared.module';
import { PageCreateComponent } from './page-create/page-create.component';
import { PageDetailComponent } from './page-detail/page-detail.component';
import { ProjectCreateComponent } from './project-create/project-create.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectListComponent } from './project-list/project-list.component';

// Static "new" segments come before the matching parameter routes; IDs are UUIDs.
const routes: Routes = [
  { path: 'new', component: ProjectCreateComponent, canDeactivate: [unsavedChangesGuard] },
  {
    path: ':projectId/pages/:pageId/workspace',
    loadChildren: () => import('../workspace/workspace.module').then(m => m.WorkspaceModule)
  },
  { path: ':projectId/pages/new', component: PageCreateComponent, canDeactivate: [unsavedChangesGuard] },
  { path: ':projectId/pages/:pageId', component: PageDetailComponent },
  { path: ':projectId', component: ProjectDetailComponent },
  { path: '', component: ProjectListComponent }
];

@NgModule({
  declarations: [ProjectListComponent, ProjectDetailComponent, PageDetailComponent, ProjectCreateComponent, PageCreateComponent],
  imports: [CommonModule, ReactiveFormsModule, SharedModule, RouterModule.forChild(routes)]
})
export class ProjectsModule { }
