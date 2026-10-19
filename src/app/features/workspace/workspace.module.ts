import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { GenerationPanelComponent } from './generation-panel/generation-panel.component';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';
import { JsonEditorComponent } from './json-editor/json-editor.component';
import { RunResultComponent } from './run-result/run-result.component';
import { WorkspaceComponent } from './workspace/workspace.component';

const routes: Routes = [
  { path: '', component: WorkspaceComponent, canDeactivate: [unsavedChangesGuard] }
];

@NgModule({
  declarations: [WorkspaceComponent, JsonEditorComponent, GenerationPanelComponent, RunResultComponent],
  imports: [CommonModule, SharedModule, RouterModule.forChild(routes)]
})
export class WorkspaceModule { }
