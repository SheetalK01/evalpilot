import { maskHeaderValue } from '@evalpilot/shared';
import { mergeMaskedHeaders } from './target-headers';

describe('mergeMaskedHeaders', () => {
  const existing = { Authorization: 'Bearer sk-live-1234567890', 'X-Team': 'support' };

  it('keeps stored values when the masked value comes back unchanged', () => {
    const incoming = {
      Authorization: maskHeaderValue(existing.Authorization),
      'X-Team': maskHeaderValue(existing['X-Team']),
    };
    expect(mergeMaskedHeaders(incoming, existing)).toEqual(existing);
  });

  it('uses new values, adds new headers and drops omitted ones', () => {
    const incoming = { Authorization: 'Bearer sk-new-key-000000', 'X-Region': 'eu' };
    expect(mergeMaskedHeaders(incoming, existing)).toEqual(incoming);
  });

  it('does not treat a mask as a value for a header that did not exist', () => {
    expect(mergeMaskedHeaders({ 'X-New': '••••••••' }, existing)).toEqual({ 'X-New': '••••••••' });
  });
});
