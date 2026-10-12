import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { HomeComponent } from './home.component';
import { LandingComponent } from './landing.component';
import { FinalCtaComponent } from './sections/final-cta.component';
import { HomeHeroComponent } from './sections/home-hero.component';
import { PlatformWorkflowComponent } from './sections/platform-workflow.component';
import { WhatGsuifDoesComponent } from './sections/what-gsuif-does.component';

@NgModule({
  declarations: [
    HomeComponent,
    LandingComponent,
    HomeHeroComponent,
    WhatGsuifDoesComponent,
    PlatformWorkflowComponent,
    FinalCtaComponent
  ],
  imports: [CommonModule, RouterModule, SharedModule],
  exports: [HomeComponent, LandingComponent]
})
export class HomeModule { }
