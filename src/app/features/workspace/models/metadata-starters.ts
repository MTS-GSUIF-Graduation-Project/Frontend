/**
 * Metadata schema versions the backend validates snapshots against
 * (`MetadataSchemaValidator`, gsuif-backend develop ba12ec80ea77444f059a47ff18d7e1da835ebf7a).
 */
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = ['1.0.0', '1.1.0', '1.2.0'];

export interface MetadataStarter {
  id: string;
  label: string;
  description: string;
  /** Schema versions this starter is known to satisfy. */
  schemaVersions: readonly string[];
  snapshot: { components: unknown[]; apiBindings: unknown[] };
}

/**
 * Starting points for a page's first metadata version. Inserting one only fills the
 * editor; saving stays an explicit action. Neither starter has API bindings, so BACKEND
 * generation needs bindings matching the chosen contract to be added first.
 */
export const METADATA_STARTERS: readonly MetadataStarter[] = [
  {
    id: 'empty',
    label: 'Empty snapshot',
    description: 'No components and no API bindings. Every supported snapshot schema requires exactly these two arrays.',
    schemaVersions: SUPPORTED_SCHEMA_VERSIONS,
    snapshot: { components: [], apiBindings: [] }
  },
  {
    id: 'single-text-field',
    label: 'Single text field (backend-verified example)',
    description: 'One text field and no API bindings, as accepted by the backend metadata API test for schema 1.0.0.',
    schemaVersions: ['1.0.0'],
    // MetadataVersionControllerIntegrationTest.java, develop ba12ec80ea77444f059a47ff18d7e1da835ebf7a.
    snapshot: {
      components: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'text-field',
        label: 'Test',
        position: { row: 0, col: 0 },
        size: { width: 6, height: 1 },
        visibility: true,
        disabled: false
      }],
      apiBindings: []
    }
  }
];
