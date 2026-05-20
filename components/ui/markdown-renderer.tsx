"use client"

import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("break-words", className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-foreground/90 mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="text-sm text-foreground/90 mb-2 last:mb-0 pl-4 space-y-0.5 list-disc">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="text-sm text-foreground/90 mb-2 last:mb-0 pl-4 space-y-0.5 list-decimal">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
        code: ({ children, className: codeClassName }) => {
          const isBlock = codeClassName?.includes("language-")
          if (isBlock) {
            return (
              <code className="block bg-muted/80 rounded px-3 py-2 text-xs font-mono text-foreground/90 overflow-x-auto">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-muted/80 rounded px-1 py-0.5 text-xs font-mono text-fey-cyan">
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-muted/80 rounded-lg p-3 mb-2 last:mb-0 overflow-x-auto text-xs">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-fey-cyan/50 pl-3 italic text-foreground/70 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-border my-3" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fey-cyan underline underline-offset-2 hover:text-fey-cyan/80"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 last:mb-0">
            <table className="text-sm w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 text-left font-semibold text-foreground bg-muted/50">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1 text-foreground/90">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
}
