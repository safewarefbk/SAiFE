/**
 * toggle-session-visibility.ts
 * Sets the `hidden` flag on a session to show or hide it from the normal session list.
 *
 * Usage:
 *   npx tsx prisma/scripts/toggle-session-visibility.ts <sessionIdentifier> <hide|show>
 */
import { prisma } from './prisma-client'

async function main() {
    const identifier = process.argv[2]
    const action     = process.argv[3]

    if (!identifier || !action || !['hide', 'show'].includes(action)) {
        console.error('Usage: npx tsx prisma/scripts/toggle-session-visibility.ts <sessionIdentifier> <hide|show>')
        process.exit(1)
    }

    const session = await prisma.session.findUnique({ where: { sessionIdentifier: identifier } })
    if (!session) {
        console.error(`❌ Session '${identifier}' not found.`)
        process.exit(1)
    }

    const newHidden = action === 'hide'

    if (session.hidden === newHidden) {
        console.log(`ℹ️  Session '${identifier}' is already ${newHidden ? 'hidden' : 'visible'}. Nothing changed.`)
        return
    }

    await prisma.session.update({ where: { id: session.id }, data: { hidden: newHidden } })
    console.log(`\n✅ Session '${identifier}' is now ${newHidden ? 'hidden' : 'visible'}.`)
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())

