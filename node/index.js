// Test file to check database connection using the connection string from the .env file
import sql from './db.js'

try {
  const result = await sql`select now() as current_time`
  console.log('Database connection successful.')
  console.log(result[0])
} catch (error) {
  console.error('Database connection failed.')
  console.error(error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
