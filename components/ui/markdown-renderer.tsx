"use client"

import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * `default` uses the app's global theme tokens (text-foreground, bg-muted, fey-cyan).
 * `scene` maps onto the dynamic --scene-* CSS variables used inside the live-session
 * scene themes, where the default tokens would clash with the active scene palette.
 */
type MarkdownVariant = "default" | "scene"

interface MarkdownRendererProps {
  content: string
  className?: string
  variant?: MarkdownVariant
}

const defaultComponents: Components = {
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
}

// Scene variant: colors come from the active scene's --scene-* tokens via inline
// styles so markdown reads correctly against any of the live-session scene palettes.
const sceneCodeBg = "color-mix(in srgb, var(--scene-border) 45%, var(--scene-surface))"
const sceneComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0" style={{ color: "var(--scene-text-primary)" }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mt-3 mb-1.5 first:mt-0" style={{ color: "var(--scene-text-primary)" }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0" style={{ color: "var(--scene-text-primary)" }}>{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm mb-2 last:mb-0 leading-relaxed" style={{ color: "var(--scene-text-primary)" }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="text-sm mb-2 last:mb-0 pl-4 space-y-0.5 list-disc" style={{ color: "var(--scene-text-primary)" }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm mb-2 last:mb-0 pl-4 space-y-0.5 list-decimal" style={{ color: "var(--scene-text-primary)" }}>{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "var(--scene-text-primary)" }}>{children}</strong>
  ),
  em: ({ children }) => <em className="italic" style={{ color: "var(--scene-text-muted)" }}>{children}</em>,
  code: ({ children, className: codeClassName }) => {
    const isBlock = codeClassName?.includes("language-")
    if (isBlock) {
      return (
        <code
          className="block rounded px-3 py-2 text-xs font-mono overflow-x-auto"
          style={{ background: sceneCodeBg, color: "var(--scene-text-primary)" }}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded px-1 py-0.5 text-xs font-mono"
        style={{ background: sceneCodeBg, color: "var(--scene-accent)" }}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre
      className="rounded-lg p-3 mb-2 last:mb-0 overflow-x-auto text-xs"
      style={{ background: sceneCodeBg }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="pl-3 italic my-2"
      style={{ borderLeft: "2px solid var(--scene-accent)", color: "var(--scene-text-muted)" }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3" style={{ borderColor: "var(--scene-border)" }} />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
      style={{ color: "var(--scene-accent)" }}
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
    <th
      className="px-2 py-1 text-left font-semibold"
      style={{ border: "1px solid var(--scene-border)", background: "var(--scene-surface)", color: "var(--scene-text-primary)" }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1" style={{ border: "1px solid var(--scene-border)", color: "var(--scene-text-primary)" }}>{children}</td>
  ),
}

export function MarkdownRenderer({ content, className, variant = "default" }: MarkdownRendererProps) {
  const components = variant === "scene" ? sceneComponents : defaultComponents
  return (
    <div className={cn("break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
