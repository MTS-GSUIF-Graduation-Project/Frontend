export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number | null; column: number | null };

/** Parses editor text and, on failure, locates the first unexpected character by line and column. */
export function parseJson(text: string): JsonParseResult {
  if (text.trim() === '') {
    return { ok: false, message: 'Enter a JSON value.', line: null, column: null };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    const offset = new SyntaxLocator(text).firstErrorOffset();
    if (offset === null) {
      return { ok: false, message: 'Invalid JSON.', line: null, column: null };
    }
    const before = text.slice(0, offset).split('\n');
    const line = before.length;
    const column = before[before.length - 1].length + 1;
    const found = offset < text.length ? `"${text[offset]}"` : 'end of input';
    return { ok: false, message: `Invalid JSON: unexpected ${found} at line ${line}, column ${column}.`, line, column };
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A minimal JSON scanner used only after `JSON.parse` has failed, because engines
 * do not consistently report where. It returns the offset of the first character
 * that cannot continue a valid document.
 */
class SyntaxLocator {
  private index = 0;

  constructor(private readonly text: string) { }

  firstErrorOffset(): number | null {
    try {
      this.value();
      this.space();
      return this.index < this.text.length ? this.index : null;
    } catch (offset) {
      return typeof offset === 'number' ? offset : null;
    }
  }

  private value(): void {
    this.space();
    const char = this.text[this.index];
    if (char === '{') {
      this.object();
    } else if (char === '[') {
      this.array();
    } else if (char === '"') {
      this.string();
    } else if (char === '-' || (char >= '0' && char <= '9')) {
      this.number();
    } else {
      this.literal();
    }
  }

  private object(): void {
    this.index++;
    this.space();
    if (this.text[this.index] === '}') {
      this.index++;
      return;
    }
    for (;;) {
      this.space();
      if (this.text[this.index] !== '"') throw this.index;
      this.string();
      this.space();
      this.expect(':');
      this.value();
      this.space();
      if (this.text[this.index] === '}') {
        this.index++;
        return;
      }
      this.expect(',');
    }
  }

  private array(): void {
    this.index++;
    this.space();
    if (this.text[this.index] === ']') {
      this.index++;
      return;
    }
    for (;;) {
      this.value();
      this.space();
      if (this.text[this.index] === ']') {
        this.index++;
        return;
      }
      this.expect(',');
    }
  }

  private string(): void {
    this.index++;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === '"') {
        this.index++;
        return;
      }
      if (char < ' ') throw this.index;
      if (char === '\\') {
        const escape = this.text[this.index + 1];
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(this.text.slice(this.index + 2, this.index + 6))) throw this.index;
          this.index += 6;
          continue;
        }
        if (!escape || !'"\\/bfnrt'.includes(escape)) throw this.index;
        this.index += 2;
        continue;
      }
      this.index++;
    }
    throw this.index;
  }

  private number(): void {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(this.text.slice(this.index));
    if (!match) throw this.index;
    this.index += match[0].length;
  }

  private literal(): void {
    for (const word of ['true', 'false', 'null']) {
      if (this.text.startsWith(word, this.index)) {
        this.index += word.length;
        return;
      }
    }
    throw this.index;
  }

  private expect(char: string): void {
    if (this.text[this.index] !== char) throw this.index;
    this.index++;
  }

  private space(): void {
    while (/\s/.test(this.text[this.index] ?? '')) this.index++;
  }
}
