import { describe, expect, it } from 'vitest';
import type { DigestRow } from '../src/digest/types.js';
import { DigestPage } from '../src/views/digest.js';

const row: DigestRow = {
  job: 'notes/backup',
  owner: null,
  runs: 4,
  retries: 3,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T01:00:00+01:00',
  lastAt: '2026-10-28T01:20:00+01:00',
};

describe('digest page view', () => {
  it('marks warn rows, renders — for missing values and counts bad lines', () => {
    const html = (<DigestPage night="2026-10-28" result={{ kind: 'rows', rows: [row], badLines: 1 }} />).toString();
    expect(html).toContain('<tr class="warn">');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('2026-10-28T01:00:00+01:00');
  });

  it('says nothing ran for an empty night', () => {
    const html = (<DigestPage night="2026-10-28" result={{ kind: 'empty' }} />).toString();
    expect(html).toContain('nothing ran');
  });
});
