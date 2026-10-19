import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ATTEMPT_RECOVERY, CONTRACT_CATALOG, PACKAGE_DOWNLOAD } from './generation-ports';

describe('generation ports', () => {
  it('lists exactly the verified BACKEND-eligible registry pairs', async () => {
    const options = await firstValueFrom(TestBed.inject(CONTRACT_CATALOG).listBackendContracts());

    expect(options.map(option => `${option.contractId}@${option.contractVersion}`)).toEqual([
      'stock-unit-api@3.0.0',
      'stock-unit-api@2.0.0',
      'asset-ticket-api@2.0.0'
    ]);
    for (const option of options) {
      expect(option.label.trim()).not.toBe('');
    }
  });

  it('excludes legacy-profile and test-only contracts', async () => {
    const ids = (await firstValueFrom(TestBed.inject(CONTRACT_CATALOG).listBackendContracts()))
      .map(option => `${option.contractId}@${option.contractVersion}`);

    for (const excluded of ['asset-ticket-api@1.0.0', 'service-request-api@1.0.0', 'case-record-api@1.0.0']) {
      expect(ids).not.toContain(excluded);
    }
    expect(ids.some(id => id.startsWith('gadget'))).toBe(false);
  });

  it('reports attempt lookup and ZIP download as unavailable until their backend contracts are integrated', async () => {
    const recovery = TestBed.inject(ATTEMPT_RECOVERY);
    const zip = TestBed.inject(PACKAGE_DOWNLOAD);

    expect(recovery.available).toBe(false);
    expect(zip.available).toBe(false);
    await expect(firstValueFrom(recovery.findRun('a'))).rejects.toMatchObject({ statusCode: 0 });
    await expect(firstValueFrom(zip.downloadZip('r'))).rejects.toMatchObject({ statusCode: 0 });
  });
});
