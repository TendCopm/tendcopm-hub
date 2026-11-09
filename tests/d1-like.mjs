/**
 * Local stand-in for D1 write behavior used by the CRM tests:
 * one writer at a time, and batch commits or rolls back as a whole.
 * It is still node:sqlite, not the remote production database.
 */

export function d1Like(raw) {
  let chain = Promise.resolve();
  function locked(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  }
  function bound(stmt, args) {
    return {
      async first() {
        return locked(() => {
          const row = stmt.get(...args);
          return row === undefined ? null : row;
        });
      },
      async all() {
        return locked(() => ({ results: stmt.all(...args) }));
      },
      async run() {
        return locked(() => {
          const info = stmt.run(...args);
          return { success: true, meta: { changes: info.changes } };
        });
      },
      bind(...more) {
        return bound(stmt, more);
      },
    };
  }
  return {
    prepare(sql) {
      return bound(raw.prepare(sql), []);
    },
    batch(entries) {
      return locked(() => {
        raw.exec('BEGIN');
        try {
          for (const entry of entries) raw.prepare(entry.sql).run(...(entry.args || []));
          raw.exec('COMMIT');
          return { success: true };
        } catch (err) {
          raw.exec('ROLLBACK');
          throw err;
        }
      });
    },
  };
}
