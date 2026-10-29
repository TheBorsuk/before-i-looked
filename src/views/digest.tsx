import type { DigestRow, NightResult } from '../digest/types.js';

const dash = '—';

function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function unreadable(badLines: number): string {
  return `${badLines} ${badLines === 1 ? 'line' : 'lines'} could not be read`;
}

export function DigestPage({ night, result }: { night: string; result: Exclude<NightResult, { kind: 'missing' }> }) {
  const rows = result.kind === 'rows' ? result.rows : [];
  const badLines = result.kind === 'rows' ? result.badLines : 0;
  return (
    <>
      <h1>digest {night}</h1>
      {badLines > 0 ? <p class="warn">{unreadable(badLines)}</p> : null}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class={isWarn(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? dash}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="mute">no such night</p>
    </>
  );
}
