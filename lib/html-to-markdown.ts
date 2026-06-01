/**
 * Convert the small subset of HTML that turns up in location notes into clean
 * Markdown, so it renders through the shared MarkdownRenderer instead of leaking
 * raw tags. The main source is Azgaar map legends (the seed pipeline stores them
 * verbatim): a `<div>`, an `<a>` link, sometimes an `<iframe>` embed.
 *
 * Pure string work (no DOMParser) so it runs in the browser AND the Node seed
 * script. It is NOT a security boundary — the Markdown is rendered downstream by
 * a sanitizing renderer (rehype-sanitize), which is. Embeds/scripts are dropped
 * here anyway since they have no Markdown equivalent. Content with no tags
 * (DM-typed Markdown) is returned untouched.
 */

const HTML_TAG = /<[a-z!/][^>]*>/i

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
}

const stripTags = (s: string): string => s.replace(/<[^>]+>/g, "")

const decodeEntities = (s: string): string =>
  s
    .replace(/&#(\d+);/g, (_m, n: string) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => safeCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m)

const safeCodePoint = (n: number): string => {
  try {
    return String.fromCodePoint(n)
  } catch {
    return ""
  }
}

export function htmlToMarkdown(input: string | null | undefined): string {
  if (!input) return ""
  let s = input
  // Fast path: no tags ⇒ already plain text / Markdown, leave it alone.
  if (!HTML_TAG.test(s)) return s.trim()

  // Drop embeds/scripts entirely (content and all) — no Markdown equivalent and
  // not safe to surface as raw HTML.
  s = s.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
  s = s.replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, "")

  // Links → [text](href). Fall back to the href as the label if empty.
  s = s.replace(
    /<a\b[^>]*?href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, text: string) => {
      const label = stripTags(text).trim()
      return `[${label || href}](${href})`
    },
  )

  // Emphasis.
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => `**${stripTags(inner).trim()}**`)
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => `*${stripTags(inner).trim()}*`)

  // List items → "- item".
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `\n- ${stripTags(inner).trim()}`)

  // Line + block boundaries → newlines.
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, "\n\n")

  // Strip whatever tags remain, decode entities, tidy whitespace.
  s = stripTags(s)
  s = decodeEntities(s)
  s = s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return s
}
