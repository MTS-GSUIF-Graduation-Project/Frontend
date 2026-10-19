import { TestBed } from '@angular/core/testing';
import { FileSaverService, safeFileName } from './file-saver.service';

/** jsdom has no object URLs, so define them for the duration of a test. */
function stubObjectUrls(url: string) {
  const create = vi.fn(() => url);
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true, writable: true });
  return { create, revoke };
}

describe('FileSaverService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads under a safe name and revokes the object URL', () => {
    vi.useFakeTimers();
    const urls = stubObjectUrls('blob:local/1');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    TestBed.inject(FileSaverService).save(new Blob(['x']), 'backend/src/../Main.java');

    expect(urls.create).toHaveBeenCalledOnce();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('Main.java');
    expect(link.href).toBe('blob:local/1');
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(urls.revoke).toHaveBeenCalledWith('blob:local/1');
  });

  it('still revokes the object URL when the download cannot start', () => {
    vi.useFakeTimers();
    const urls = stubObjectUrls('blob:local/2');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => TestBed.inject(FileSaverService).save(new Blob(['x']), 'a.zip')).toThrow('blocked');
    vi.runAllTimers();
    expect(urls.revoke).toHaveBeenCalledWith('blob:local/2');
  });
});

describe('safeFileName', () => {
  it('keeps only a clean last path segment', () => {
    expect(safeFileName('a\\b\\c.txt')).toBe('c.txt');
    expect(safeFileName('../..')).toBe('download');
    expect(safeFileName('re<port>?.md')).toBe('report.md');
    expect(safeFileName('')).toBe('download');
  });
});
