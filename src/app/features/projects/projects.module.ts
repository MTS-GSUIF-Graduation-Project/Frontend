import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { PageDetailComponent } from './page-detail/page-detail.component';
import { ProjectDetailComponent } from './project-detail/project-detail.component';
import { ProjectListComponent } from './project-list/project-list.component';

const routes: Routes = [
  { path: ':projectId/pages/:pageId', component: PageDetailComponent },
  { path: ':projectId', component: ProjectDetailComponent },
  { path: '', component: ProjectListComponent }
];

@NgModule({
  declarations: [ProjectListComponent, ProjectDetailComponent, PageDetailComponent],
  imports: [CommonModule, SharedModule, RouterModule.forChild(routes)]
})
export class ProjectsModule { }
