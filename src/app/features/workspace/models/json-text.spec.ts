import { isJsonObject, parseJson } from './json-text';

describe('parseJson', () => {
  it('returns the parsed value for valid JSON', () => {
    expect(parseJson('{"components": []}')).toEqual({ ok: true, value: { components: [] } });
  });

  it('asks for input when the text is blank', () => {
    expect(parseJson('   ')).toEqual({ ok: false, message: 'Enter a JSON value.', line: null, column: null });
  });

  it('locates a missing value on a later line', () => {
    expect(parseJson('{\n  "a": 1,\n  "b": }')).toEqual({
      ok: false,
      message: 'Invalid JSON: unexpected "}" at line 3, column 8.',
      line: 3,
      column: 8
    });
  });

  it('locates a trailing comma', () => {
    const result = parseJson('[1, 2,]');
    expect(result.ok).toBe(false);
    expect(result.ok ? null : [result.line, result.column]).toEqual([1, 7]);
  });

  it('reports an unterminated string at the end of input', () => {
    const result = parseJson('{"a": "open');
    expect(result.ok ? null : result.message).toBe('Invalid JSON: unexpected end of input at line 1, column 12.');
  });

  it('locates trailing content after a complete value', () => {
    const result = parseJson('{} x');
    expect(result.ok ? null : [result.line, result.column]).toEqual([1, 4]);
  });
});

describe('isJsonObject', () => {
  it('accepts only plain objects', () => {
    expect(isJsonObject({})).toBe(true);
    expect(isJsonObject([])).toBe(false);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject('x')).toBe(false);
  });
});
