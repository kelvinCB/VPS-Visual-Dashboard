// db.js - optional Postgres plumbing (non-invasive)
//
// If DATABASE_URL is not set, the app behaves exactly as before.
// If set, we create a lazy Pool that can be used by future features.
//
// Note: We intentionally do NOT run migrations or create tables at startup.

let _pool = null;

function getDbPool() {
    const url = process.env.DATABASE_URL;
    if (!url) return null;

    if (_pool) return _pool;

    // Lazy-require so installations without pg usage don't break at require-time.
    // (pg is in dependencies, but this keeps the module lightweight)
    // eslint-disable-next-line global-require
    const { Pool } = require('pg');

    _pool = new Pool({ connectionString: url });
    return _pool;
}

async function closeDbPool() {
    if (_pool) {
        const p = _pool;
        _pool = null;
        try { await p.end(); } catch { /* ignore */ }
    }
}

module.exports = { getDbPool, closeDbPool };
