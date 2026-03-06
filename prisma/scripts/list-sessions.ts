/**
 * list-sessions.ts
 * Lists all sessions including hidden ones.
 *
 * Usage:
 *   npx tsx prisma/scripts/list-sessions.ts
 */
import { prisma } from './prisma-client'

async function main() {
    const sessions = await prisma.session.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
            _count: { select: { nodes: true, edges: true, codes: true, diagramHistory: true } }
        }
    })

    if (sessions.length === 0) {
        console.log('No sessions found.')
        return
    }

    console.log('\n📋 Sessions:\n')
    console.log('  ' + 'Status'.padEnd(10) + 'Identifier'.padEnd(45) + 'Nodes'.padEnd(8) + 'Edges'.padEnd(8) + 'Codes'.padEnd(8) + 'History'.padEnd(10) + 'Created')
    console.log('  ' + '─'.repeat(100))

    for (const s of sessions) {
        const vis     = s.hidden ? '[hidden] ' : '[visible]'
        const created = s.createdAt.toISOString().replace('T', ' ').slice(0, 19)
        console.log(
            `  ${vis} ${s.sessionIdentifier.padEnd(45)}` +
            `${String(s._count.nodes).padEnd(8)}${String(s._count.edges).padEnd(8)}` +
            `${String(s._count.codes).padEnd(8)}${String(s._count.diagramHistory).padEnd(10)}${created}`
        )
    }
    console.log()
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())

