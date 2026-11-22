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

// Run one parameterised statement and return its rows
export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured')
  }

  const result = await pool.query(sql, params)
  return result.rows
}

export async function closeDatabase() {
  if (pool) {
    await pool.end()
  }
}
