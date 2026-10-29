import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { sortRows } from './digest/sort.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', async (c) => {
    const night = c.req.param('night');
    const digest = await readNight(config.runsDir, night);
    if (!digest) return c.json({ error: `no digest for ${night}` }, 404);
    return c.json({ night, badLines: digest.badLines, rows: sortRows(digest.rows) });
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', async (c) => {
    const night = c.req.param('night');
    const digest = await readNight(config.runsDir, night);
    if (!digest) return c.notFound();
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} rows={digest.rows} badLines={digest.badLines} />
      </Layout>,
    );
  });

  return app;
}
