/**
 * Shared Prisma client for CLI scripts.
 * Mirrors the adapter setup in src/lib/prisma.ts.
 * Works with SQLite (dev) and PostgreSQL (prod) — no changes needed when switching.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const dbUrl = process.env.DATABASE_URL ?? `file:${path.join(projectRoot, 'prisma', 'dev.db')}`

const adapter = new PrismaLibSql({ url: dbUrl })
export const prisma = new PrismaClient({ adapter })

