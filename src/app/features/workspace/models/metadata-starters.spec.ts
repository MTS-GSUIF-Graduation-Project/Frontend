import { METADATA_STARTERS, SUPPORTED_SCHEMA_VERSIONS } from './metadata-starters';

describe('metadata starters', () => {
  it('lists exactly the schema versions the backend supports', () => {
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual(['1.0.0', '1.1.0', '1.2.0']);
  });

  it('only contain the two arrays every snapshot schema requires', () => {
    for (const starter of METADATA_STARTERS) {
      expect(Object.keys(starter.snapshot).sort()).toEqual(['apiBindings', 'components']);
      expect(starter.schemaVersions.every(version => SUPPORTED_SCHEMA_VERSIONS.includes(version))).toBe(true);
    }
  });

  it('keeps the backend-verified example byte for byte', () => {
    const example = METADATA_STARTERS.find(starter => starter.id === 'single-text-field');

    expect(JSON.stringify(example?.snapshot)).toBe(
      '{"components":[{"id":"123e4567-e89b-12d3-a456-426614174000","type":"text-field","label":"Test",'
      + '"position":{"row":0,"col":0},"size":{"width":6,"height":1},"visibility":true,"disabled":false}],"apiBindings":[]}'
    );
    expect(example?.schemaVersions).toEqual(['1.0.0']);
  });
});
