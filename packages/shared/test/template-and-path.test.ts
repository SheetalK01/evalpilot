import { describe, expect, it } from 'vitest';
import {
  answerToText,
  jsonEscape,
  parseJsonPath,
  readJsonPath,
  renderBodyTemplate,
  renderUrlTemplate,
} from '../src';

describe('renderBodyTemplate', () => {
  it('JSON-escapes the input so the body stays valid JSON', () => {
    const input = 'He said "hi"\nand left \\ {{input}}';
    const body = renderBodyTemplate('{"message":"{{input}}"}', input);
    expect(JSON.parse(body)).toEqual({ message: input });
  });

  it('replaces every placeholder, with optional spaces', () => {
    expect(renderBodyTemplate('{{input}}|{{ input }}', 'x')).toBe('x|x');
  });

  it('does not interpret $ patterns in the input', () => {
    expect(renderBodyTemplate('"{{input}}"', "$& $1 $'")).toBe('"$& $1 $\'"');
  });

  it('escapes control and unicode characters', () => {
    expect(jsonEscape('tab\there')).toBe('tab\\there');
  });
});

describe('renderUrlTemplate', () => {
  it('URL-encodes the input', () => {
    expect(renderUrlTemplate('https://x.dev/ask?q={{input}}', 'a&b c')).toBe('https://x.dev/ask?q=a%26b%20c');
    expect(renderUrlTemplate('https://x.dev/ask?q=%7B%7Binput%7D%7D', 'é')).toBe(
      'https://x.dev/ask?q=%C3%A9',
    );
  });
});

describe('JSON path', () => {
  const response = {
    choices: [{ message: { content: 'Hello!' } }],
    data: { 'answer text': 'quoted key', count: 3 },
  };

  it.each([
    ['$', response],
    ['', response],
    ['$.choices[0].message.content', 'Hello!'],
    ['choices[0].message.content', 'Hello!'],
    ['choices.0.message.content', 'Hello!'],
    ["$.data['answer text']", 'quoted key'],
    ['$.data["answer text"]', 'quoted key'],
    ['$.data.count', 3],
    ['$.missing.deep', undefined],
    ['$.choices[5].message', undefined],
    ['$.choices.first', undefined],
  ])('reads %s', (path, expected) => {
    expect(readJsonPath(response, path)).toEqual(expected);
  });

  it('rejects malformed paths', () => {
    expect(() => parseJsonPath('$.a[')).toThrow('Invalid JSON path');
  });
});

describe('answerToText', () => {
  it.each([
    [undefined, ''],
    [null, ''],
    ['text', 'text'],
    [42, '42'],
    [true, 'true'],
    [{ a: 1 }, '{"a":1}'],
  ])('converts %j', (value, expected) => {
    expect(answerToText(value)).toBe(expected);
  });
});
