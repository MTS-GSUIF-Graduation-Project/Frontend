import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Saves a Blob to the user's device and always releases the temporary object URL. */
@Injectable({ providedIn: 'root' })
export class FileSaverService {
  private readonly document = inject(DOCUMENT);

  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    try {
      link.href = url;
      link.download = safeFileName(fileName);
      link.rel = 'noopener';
      this.document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Revoke on the next task so the browser has started reading the URL.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

/** The last path segment, without characters that are unsafe in file names. */
export function safeFileName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '').replace(/^\.+/, '').trim();
  return cleaned || 'download';
}
