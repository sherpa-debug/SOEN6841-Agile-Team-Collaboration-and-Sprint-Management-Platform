import pg from 'pg'

const { Pool } = pg
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null

export async function checkDatabase() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured')
  }

  await pool.query('SELECT 1')
}

export function getDatabasePool() {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured')
  }
  return pool
}

export async function closeDatabase() {
  if (pool) {
    await pool.end()
  }
}
