const PLACEHOLDER = /\{\{\s*input\s*\}\}/g;

/** Escapes text so it can sit inside a JSON string literal (without the surrounding quotes). */
export function jsonEscape(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

/**
 * Replaces `{{input}}` in a target's body template with the JSON-escaped input, so a template
 * like `{"message": "{{input}}"}` stays valid JSON whatever the input contains.
 */
export function renderBodyTemplate(template: string, input: string): string {
  return template.replace(PLACEHOLDER, () => jsonEscape(input));
}

/** For GET targets the input goes into the URL, URL-encoded. */
export function renderUrlTemplate(url: string, input: string): string {
  return url
    .replace(PLACEHOLDER, () => encodeURIComponent(input))
    .replace(/%7B%7Binput%7D%7D/gi, () => encodeURIComponent(input));
}
