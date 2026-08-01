import type { ReactNode } from 'react'
import type { Language } from '@/lib/translations'
import { cn } from '@/lib/cn'

/**
 * Every flag code the component can render. `Language` covers the app's five
 * current languages; the extra codes (at/ch) are pre-added for future
 * language extensions (Swiss/Austrian variants, ...).
 * To add a new flag: extend this union + add one entry to FLAG_RENDERERS
 * (the Record type enforces it at compile time). See CONTRIBUTING.md.
 */
export type FlagCode = Language | 'at' | 'ch'

interface FlagProps {
  code: FlagCode
  className?: string
}

/**
 * Three equal stripes — `vertical` renders left→right columns (FR, IT),
 * otherwise top→bottom rows (DE, HU, AT).
 * Stripe thickness is computed in JS, NOT as a "16 / 3" string in the SVG
 * attribute — that is invalid SVG/CSS syntax and would render the rect with
 * height 0 → blank flags.
 */
function Stripes({
  vertical = false,
  colors,
}: {
  vertical?: boolean
  colors: [string, string, string]
}) {
  const stripe = 16 / 3
  return vertical ? (
    <>
      <rect x="0" y="0" width="8" height="16" fill={colors[0]} />
      <rect x="8" y="0" width="8" height="16" fill={colors[1]} />
      <rect x="16" y="0" width="8" height="16" fill={colors[2]} />
    </>
  ) : (
    <>
      <rect x="0" y="0" width="24" height={stripe} fill={colors[0]} />
      <rect x="0" y={stripe} width="24" height={stripe} fill={colors[1]} />
      <rect x="0" y={stripe * 2} width="24" height={stripe} fill={colors[2]} />
    </>
  )
}

/** Switzerland — red field with a centered white cross. */
function SwissCross() {
  return (
    <>
      <rect width="24" height="16" fill="#D52B1E" />
      <rect x="9" y="6.5" width="6" height="3" fill="#FFFFFF" />
      <rect x="10.5" y="5" width="3" height="6" fill="#FFFFFF" />
    </>
  )
}

/**
 * United Kingdom — Union Jack: blue field, St Andrew (white) + St Patrick
 * (red, offset) saltires, St George cross (white, red core).
 */
function UnionJack() {
  return (
    <>
      <rect width="24" height="16" fill="#012169" />
      <path d="M-1.5 17.5 L25.5 -1.5" stroke="#FFFFFF" strokeWidth="4.6" />
      <path d="M-1.5 -1.5 L25.5 17.5" stroke="#FFFFFF" strokeWidth="4.6" />
      <path d="M-2 18 L22 2" stroke="#C8102E" strokeWidth="2" />
      <path d="M2 -2 L26 14" stroke="#C8102E" strokeWidth="2" />
      <rect x="0" y="6.3" width="24" height="3.4" fill="#FFFFFF" />
      <rect x="10.3" y="0" width="3.4" height="16" fill="#FFFFFF" />
      <rect x="0" y="7.15" width="24" height="1.7" fill="#C8102E" />
      <rect x="11.15" y="0" width="1.7" height="16" fill="#C8102E" />
    </>
  )
}

/**
 * Typed record — every FlagCode MUST have a renderer (compile-time error
 * if a code is added to the union without a renderer here). Official colors.
 */
const FLAG_RENDERERS: Record<FlagCode, () => ReactNode> = {
  de: () => <Stripes colors={['#000000', '#DD0000', '#FFCE00']} />,
  fr: () => <Stripes vertical colors={['#0055A4', '#FFFFFF', '#EF4135']} />,
  it: () => <Stripes vertical colors={['#009246', '#FFFFFF', '#CE2B37']} />,
  hu: () => <Stripes colors={['#CD2A3E', '#FFFFFF', '#436F4D']} />,
  en: () => <UnionJack />,
  at: () => <Stripes colors={['#ED2939', '#FFFFFF', '#ED2939']} />,
  ch: () => <SwissCross />,
}

/**
 * Inline SVG flag — reliable on every platform. Flag EMOJI (🇩🇪/🇫🇷/🇮🇹/🇭🇺)
 * render natively on Android but NOT on Windows desktop Chrome/Firefox (the
 * OS font has no flag glyphs), which is why the language pills showed flags
 * on mobile but blank on the web. SVG has no such limitation.
 */
export function Flag({ code, className }: FlagProps) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={cn('w-6 h-4 rounded-[2px] ring-1 ring-black/10 shrink-0', className)}
      aria-hidden="true"
    >
      {FLAG_RENDERERS[code]()}
    </svg>
  )
}
