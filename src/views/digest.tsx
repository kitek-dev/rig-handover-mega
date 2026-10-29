import { sortRows } from '../digest/sort.js';
import type { DigestRow } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night, rows, badLines }: { night: string; rows: DigestRow[]; badLines: number }) {
  const sorted = sortRows(rows);
  return (
    <>
      <h1>digest {night}</h1>
      {badLines > 0 ? <p class="warn">{badLines} unreadable line(s) skipped</p> : null}
      {sorted.length === 0 ? (
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
            {sorted.map((r) => {
              const manyRetries = r.retries >= 3;
              const failed = r.lastStatus === 'fail';
              return (
                <tr class={manyRetries || failed ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{r.owner ?? dash}</td>
                  <td>{r.runs}</td>
                  <td>{manyRetries ? `${r.retries} (many retries)` : r.retries}</td>
                  <td>{failed ? 'FAIL' : r.lastStatus}</td>
                  <td>{r.lastError ?? dash}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
