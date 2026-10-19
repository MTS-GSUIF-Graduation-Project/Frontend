import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { parseJson } from '../models/json-text';

/** A plain-text JSON editor with local syntax feedback and server validation errors by path. */
@Component({
  selector: 'app-json-editor',
  standalone: false,
  templateUrl: './json-editor.component.html',
  styleUrl: '../workspace.shared.css'
})
export class JsonEditorComponent implements OnChanges {
  @Input({ required: true }) editorId = '';
  @Input({ required: true }) label = '';
  @Input() hint = '';
  @Input() value = '';
  @Input() disabled = false;
  @Input() serverErrors: Record<string, string> | null = null;
  @Output() valueChange = new EventEmitter<string>();

  syntaxError = '';

  get serverErrorList(): { path: string; message: string }[] {
    return Object.entries(this.serverErrors ?? {}).map(([path, message]) => ({ path, message }));
  }

  get describedBy(): string | null {
    const ids = [
      this.hint ? `${this.editorId}-hint` : '',
      this.syntaxError ? `${this.editorId}-syntax` : '',
      this.serverErrorList.length ? `${this.editorId}-server` : ''
    ].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  ngOnChanges(): void {
    this.check(this.value);
  }

  onInput(event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.check(text);
    this.valueChange.emit(text);
  }

  private check(text: string): void {
    const result = text.trim() === '' ? null : parseJson(text);
    this.syntaxError = result && !result.ok ? result.message : '';
  }
}
