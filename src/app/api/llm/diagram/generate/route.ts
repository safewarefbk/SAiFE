import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { description, includeNonFunctional } = await req.json();
        const apiKey = process.env.NEXT_PUBLIC_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const nonFunctionalInstruction = includeNonFunctional
            ? "Include also non-functional requirements (soft goals, round-rectangle nodes) in the model."
            : "Do NOT include non-functional requirements (no soft goals, no round-rectangle nodes) in the model.";

        const originalPrompt = `You are a requirements analyst. Your task is to generate an Initial Requirements Model of a software system as a tree-structured graph in JSON format, with two sections: nodes and edges.
                ${nonFunctionalInstruction}

                Node types:
                - Circle = functional goal (main or sub-goal).
                - Capsule = logical operator AND.
                - Hexagon = task (implementable activity).
                - Round-rectangle = soft goal (non-functional requirement).

                Input:
                The system to be modeled is described as: ${
                            description !== ""
                                ? description
                                : "I don't have any ideas currently so, you can create requirements for any software project as an example"
                            }

                Expected output:
                - A tree graph in JSON with nodes and edges.
                - Each node must include x,y coordinates and consistent style.
                - The graph must follow the rules below.
                
                Rules:
                1. General structure:
                    - Only one main functional goal (circle) as the root.
                    - Every other node must have at least one parent.
                    - Each hexagon (task) must connect to a circle.
                    - Each round-rectangle (soft goal) must connect to a hexagon.
                    - A circle must be connected to at least two hexagons (tasks) otherwise just use one hexagon.
                2. Connections:
                    - No duplicate edges between two nodes.
                    - Only edges to soft goals MUST be dotted.
                    - Dotted edges to soft goals MUST have a '+' if the impact is positive or a '-' label in the middle of the edge.
                    - A node cannot have both + and - impacts to the same soft goal.
                    - All other edges must be solid.
                3. AND operator:
                    - Use capsule: AND only if a node has two or more children.
                    - The AND operator must be placed above its children.
                4. Layout:
                    - NEVER make nodes overlap.
                    - Edges must NEVER cross other edges or nodes.
                    - Subtrees must be visually well composed and distinguishable.
                    - Nodes at the same y-axis MUST be at least 400px apart on the x-axis.
                    - Edges MUST be at least 30px long.
                5. Style:
                    - Keep it coincise and simple.
                    - The text of the nodes must NEVER be longer than the node itself.
                    - Remember to implement cybersecurity requirements.
                    - Use short text for node contents.
                    - Remember to insert the '+' or '-' label on dotted edges to soft goals.
                    - All nodes must have color #438D57.
                    - Node sizes must be consistent with the provided example.
                    - IMPORTANT: "style.width" and "style.height" must be NUMERIC values, not strings with "px".
                    - Edges must follow this format:
                    {
                        "type": "editable-edge",
                        "style": { "strokeWidth": 2 },
                        "source": "nodeId1",
                        "sourceHandle": "top",
                        "target": "nodeId2",
                        "targetHandle": "bottom",
                        "id": "xy-edge__nodeId1top-nodeId2bottom"
                    }

                Here is an example of the expected JSON format:
                {
                "nodes": [
                    {
                    "id": "1",
                    "type": "shape",
                    "position": { "x": 400, "y": 50 },
                    "style": { "width": 200, "height": 70 },
                    "data": { "type": "circle", "contents": "Order Food Online", "color": "#438D57" }
                    },
                    {
                    "id": "2",
                    "type": "shape",
                    "position": { "x": 400, "y": 180 },
                    "style": { "width": 42, "height": 22 },
                    "data": { "type": "capsule", "contents": "AND", "color": "#438D57" }
                    },
                    {
                    "id": "3",
                    "type": "shape",
                    "position": { "x": 200, "y": 300 },
                    "style": { "width": 200, "height": 70 },
                    "data": { "type": "circle", "contents": "Browse Menu", "color": "#438D57" }
                    }
                ],
                "edges": [
                    {
                    "type": "editable-edge",
                    "style": { "strokeWidth": 2 },
                    "source": "2",
                    "sourceHandle": "top",
                    "target": "1",
                    "targetHandle": "bottom",
                    "id": "xy-edge__2top-1bottom"
                    },
                    {
                    "type": "editable-edge",
                    "style": { "strokeWidth": 2 },
                    "source": "3",
                    "sourceHandle": "top",
                    "target": "2",
                    "targetHandle": "bottom",
                    "id": "xy-edge__3top-2bottom"
                    }
                ]
                }
                Output only the JSON, no explanations.`;

        const generationConfig = {
            temperature: 1,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 65365,
            responseMimeType: "application/json",
        };

        const chatSession = model.startChat({
            generationConfig,
            history: []
        });

        const result = await chatSession.sendMessage(originalPrompt);
        const responseText = result.response.text();

        const history = [
            { role: "user", parts: [{ text: originalPrompt }] },
            { role: "model", parts: [{ text: responseText }] }
        ];

        return NextResponse.json({ responseText, history });

    } catch (error: any) {
        console.error("Error generating diagram:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

