/**
 * copy-session.ts
 * Deep-copies a session (nodes, edges, codes, diagram history) under a new identifier.
 *
 * Usage:
 *   npx tsx prisma/scripts/copy-session.ts <sourceIdentifier> <destIdentifier>
 */
import { prisma } from './prisma-client'

async function main() {
    const sourceIdentifier = process.argv[2]
    const destIdentifier   = process.argv[3]

    if (!sourceIdentifier || !destIdentifier) {
        console.error('Usage: npx tsx prisma/scripts/copy-session.ts <sourceIdentifier> <destIdentifier>')
        process.exit(1)
    }

    // Validate source
    const source = await prisma.session.findUnique({
        where: { sessionIdentifier: sourceIdentifier },
        include: { nodes: true, edges: true, codes: true, diagramHistory: true }
    })
    if (!source) {
        console.error(`❌ Session '${sourceIdentifier}' not found.`)
        process.exit(1)
    }

    // Validate destination doesn't exist
    const existing = await prisma.session.findUnique({ where: { sessionIdentifier: destIdentifier } })
    if (existing) {
        console.error(`❌ Session '${destIdentifier}' already exists. Choose a different name.`)
        process.exit(1)
    }

    console.log(`\n🔁 Copying '${sourceIdentifier}' → '${destIdentifier}'...`)

    await prisma.$transaction(async tx => {
        // 1. Create new session
        const newSession = await tx.session.create({
            data: {
                sessionIdentifier: destIdentifier,
                projectDescription: source.projectDescription,
                language: source.language,
                hidden: false,
            }
        })

        // 2. Copy codes and build old→new id map (codeId re-linking)
        const codeIdMap = new Map<string, string>()
        for (const c of source.codes) {
            const nc = await tx.code.create({
                data: {
                    sessionId:   newSession.id,
                    nodeId:      c.nodeId,
                    code:        c.code,
                    prompt:      c.prompt,
                    language:    c.language,
                    isValidated: c.isValidated,
                }
            })
            codeIdMap.set(c.id, nc.id)
        }

        // 3. Copy nodes, re-linking codeId to new code rows
        for (const n of source.nodes) {
            await tx.node.create({
                data: {
                    id:          n.id,
                    sessionId:   newSession.id,
                    positionX:   n.positionX,
                    positionY:   n.positionY,
                    shapeType:   n.shapeType,
                    contents:    n.contents,
                    collapsed:   n.collapsed,
                    width:       n.width,
                    height:      n.height,
                    hidden:      n.hidden,
                    expandPrompt: n.expandPrompt,
                    codeId:      n.codeId ? (codeIdMap.get(n.codeId) ?? null) : null,
                }
            })
        }

        // 4. Copy edges
        for (const e of source.edges) {
            await tx.edge.create({
                data: {
                    id:             e.id,
                    sessionId:      newSession.id,
                    source:         e.source,
                    target:         e.target,
                    label:          e.label,
                    strokeDasharray: e.strokeDasharray,
                    hidden:         e.hidden,
                }
            })
        }

        // 5. Copy diagram history
        for (const h of source.diagramHistory) {
            await tx.diagramHistory.create({
                data: { sessionId: newSession.id, role: h.role, content: h.content }
            })
        }

        console.log(`\n✅ Session copied successfully!`)
        console.log(`   Source     : ${sourceIdentifier}`)
        console.log(`   Destination: ${destIdentifier}`)
        console.log(`   Nodes: ${source.nodes.length}  Edges: ${source.edges.length}  Codes: ${source.codes.length}  History: ${source.diagramHistory.length}`)
    })
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())

