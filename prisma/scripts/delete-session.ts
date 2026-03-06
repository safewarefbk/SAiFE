/**
 * delete-session.ts
 * Permanently removes a session and all its data (cascade: nodes, edges, codes, history).
 *
 * Usage:
 *   npx tsx prisma/scripts/delete-session.ts <sessionIdentifier>
 */
import * as readline from 'readline'
import { prisma } from './prisma-client'

function ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

async function main() {
    const identifier = process.argv[2]

    if (!identifier) {
        console.error('Usage: npx tsx prisma/scripts/delete-session.ts <sessionIdentifier>')
        process.exit(1)
    }

    const session = await prisma.session.findUnique({
        where: { sessionIdentifier: identifier },
        include: {
            _count: { select: { nodes: true, edges: true, codes: true, diagramHistory: true } }
        }
    })

    if (!session) {
        console.error(`❌ Session '${identifier}' not found.`)
        process.exit(1)
    }

    console.log('\n⚠️  You are about to permanently delete:')
    console.log(`   Session     : ${identifier}`)
    console.log(`   Nodes       : ${session._count.nodes}`)
    console.log(`   Edges       : ${session._count.edges}`)
    console.log(`   Code entries: ${session._count.codes}`)
    console.log(`   History rows: ${session._count.diagramHistory}`)
    console.log()

    const confirm = await ask(`Type the session identifier again to confirm: `)
    if (confirm !== identifier) {
        console.error('❌ Confirmation did not match. Aborting.')
        process.exit(1)
    }

    await prisma.session.delete({ where: { id: session.id } })
    console.log(`\n✅ Session '${identifier}' and all its data have been deleted.`)
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())

