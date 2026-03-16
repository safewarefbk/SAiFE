/**
 * Shared Prisma client for CLI scripts.
 * DATABASE_URL must be set in the environment (or in the .env file at project root).
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from project root so DATABASE_URL is available when running scripts directly
config({ path: path.resolve(__dirname, '..', '..', '.env') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Configure it in your .env file.')
}

const adapter = new PrismaPg({ connectionString })
export const prisma = new PrismaClient({ adapter })
