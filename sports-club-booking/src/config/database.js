'use strict';
require('dotenv').config();
const sql = require('mssql');
let poolPromise;
function config() {
  const instance = process.env.DB_INSTANCE;
  return {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'sports_club_booking',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(instance ? {} : { port: Number(process.env.DB_PORT || 1433) }),
    connectionTimeout: 15000, requestTimeout: 30000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true',
      useUTC: true,
      ...(instance ? { instanceName: instance } : {})
    }
  };
}
async function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(config());
    pool.on('error', error => console.error('Database pool:', error.code || 'connection error'));
    poolPromise = pool.connect().catch(error => { poolPromise = null; throw error; });
  }
  return poolPromise;
}
async function closePool() {
  if (poolPromise) { const pool = await poolPromise; poolPromise = null; await pool.close(); }
}
module.exports = { sql, config, getPool, closePool };
