import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import type { NightResult } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestMissing, DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

// Only a plain calendar-style night reaches the runs dir: no path traversal.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();
  // One reader call for the page and the JSON, so they never disagree (ADR 0001).
  const readValidNight = (night: string): NightResult =>
    NIGHT.test(night) ? readNight(config.runsDir, night) : { kind: 'missing' };

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readValidNight(night);
    if (result.kind === 'missing') {
      return c.html(
        <Layout title={`digest ${night}`} lane={lane()}>
          <DigestMissing night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} result={result} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readValidNight(night);
    if (result.kind === 'missing') return c.json({ error: 'no such night' }, 404);
    if (result.kind === 'empty') return c.json({ night, rows: [], badLines: 0 });
    return c.json({ night, rows: result.rows, badLines: result.badLines });
  });

  return app;
}
