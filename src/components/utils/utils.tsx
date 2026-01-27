import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Node, Edge } from "@xyflow/react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getDefaultSize = (width: number) => {
    if (width < 1024) {
        return 33;
    } else return 20;
};

export const getCacheKey = (graphIndex: number, nodeId: string) => {
    return `${graphIndex}_${nodeId}`;
};

export const findRootNodes = (nodes: Node[], edges: Edge[]) => {
    return nodes.filter(node => !edges.some(edge => edge.source === node.id));
};

export const findDirectCodeChildren = (nodeId: string, nodes: Node[], edges: Edge[]): string[] => {
    const queue: string[] = [nodeId];
    const visited = new Set<string>();
    const codeNodeIds: string[] = [];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const childEdges = edges.filter(edge => edge.target === currentId);

        for (const edge of childEdges) {
            const childNode = nodes.find(n => n.id === edge.source);
            if (!childNode) continue;

            if (childNode.data?.type === "circle" || childNode.data?.type === "hexagon") {
                codeNodeIds.push(edge.source);
            }
            else if (childNode.data?.type === "capsule" || childNode.data?.type === "round-rectangle") {
                queue.push(edge.source);
            }
        }
    }

    return codeNodeIds;
};


export const detectProgrammingLanguage = (description: string): string => {
  const text = description.toLowerCase();
  
  const languagePatterns = [
      {
          name: "TypeScript",
          patterns: ["typescript", "ts", "angular", "nest.js", "nestjs", "deno"],
          keywords: ["interface", "type", "enum", "namespace"],
          score: 0
      },
      {
          name: "JavaScript",
          patterns: ["javascript", "js", "node.js", "nodejs", "react", "vue", "express", "npm"],
          keywords: ["function", "const", "let", "var", "async", "await"],
          score: 0
      },
      {
          name: "Python",
          patterns: ["python", "django", "flask", "fastapi", "pandas", "numpy", "pytorch"],
          keywords: ["def", "class", "import", "from", "__init__"],
          score: 0
      },
      {
          name: "Java",
          patterns: ["java", "spring", "springboot", "maven", "gradle", "jvm"],
          keywords: ["public", "private", "protected", "class", "interface"],
          score: 0
      },
      {
          name: "C#",
          patterns: ["c#", "csharp", "\\.net", "dotnet", "asp\\.net", "blazor"],
          keywords: ["public", "private", "namespace", "using"],
          score: 0
      },
      {
          name: "Go",
          patterns: ["golang", "go lang"],
          keywords: ["func", "package", "import", "goroutine"],
          score: 0
      },
      {
          name: "Rust",
          patterns: ["rust", "cargo"],
          keywords: ["fn", "let", "mut", "struct", "enum", "impl"],
          score: 0
      },
      {
          name: "PHP",
          patterns: ["php", "laravel", "symfony", "wordpress"],
          keywords: ["<\\?php", "function", "class", "\\$"],
          score: 0
      },
      {
          name: "Ruby",
          patterns: ["ruby", "rails", "gem"],
          keywords: ["def", "class", "module", "end"],
          score: 0
      },
      {
          name: "C++",
          patterns: ["c\\+\\+", "cpp", "cplusplus"],
          keywords: ["#include", "namespace", "std::", "class"],
          score: 0
      },
      {
          name: "C",
          patterns: ["\\bc\\b", "embedded", "microcontroller"],
          keywords: ["#include", "stdio.h", "malloc", "printf"],
          score: 0
      }
  ];

  languagePatterns.forEach(lang => {
      lang.patterns.forEach(pattern => {
          try {
              const regex = new RegExp(pattern, 'gi');
              const matches = (text.match(regex) || []).length;
              lang.score += matches * 3;
          } catch (e) {
              console.warn(`Regex error for pattern "${pattern}":`, e);
              if (text.includes(pattern.toLowerCase())) {
                  lang.score += 3;
              }
          }
      });

      lang.keywords.forEach(keyword => {
          if (text.includes(keyword.toLowerCase())) {
              lang.score += 2;
          }
      });

      if (text.includes(lang.name.toLowerCase())) {
          lang.score += 20;
      }
  });

  const bestMatch = languagePatterns.reduce((best, current) => 
      current.score > best.score ? current : best
  );

  return bestMatch.score > 0 ? bestMatch.name : "Python";
};
