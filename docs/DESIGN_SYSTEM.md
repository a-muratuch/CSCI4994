# Design system

## Direction and current status

MoveFlow uses a clean, modern SaaS style: black primary actions, white backgrounds, neutral-gray surfaces, restrained red brand accents, green success, amber warning, and red errors. Prioritize legible forms, clear tables, and understandable status over decoration. Blue is not a brand color.

The foundation is implemented in `app/globals.css` and demonstrated at `/design-system`. The page reuses the installed Nova primitives for typography, buttons, cards, labeled inputs, badges, and static status specimens. Geist Sans and Mono are loaded by the root layout; Tailwind’s sans and heading tokens resolve to `--font-geist-sans`. No product workflows are implemented.

## Target palette

These are the light-theme values. Status text has dedicated pale surfaces; dark mode retains corresponding high-contrast text and dark surfaces.

| Role | Target | Usage |
| --- | --- | --- |
| Background/card | `#FFFFFF` | Main canvas and cards |
| Foreground/primary | `#171717` | Main text and primary buttons |
| Primary foreground | `#FFFFFF` | Text on primary buttons |
| Secondary/muted surface | `#F5F5F5` | Subtle panels and hover surfaces |
| Muted foreground | `#525252` | Supporting readable text |
| Border | `#E5E5E5` | Subtle separators; use stronger borders where controls need contrast |
| Brand red | `#DC2626` | Small brand highlights and emphasis |
| Destructive/error | `#B91C1C` | Destructive actions and error text |
| Success | `#15803D` | Success text/icons with optional pale green background |
| Warning | `#92400E` | Warning text/icons with optional pale amber background |

Keep brand red and destructive behavior semantically separate even though both are red. Reserve destructive button treatment for destructive actions. Keep shadcn's `accent` token a neutral interaction surface; introduce a separate brand token when implementing branding rather than making every menu hover red.

Define shared semantic CSS variables and their Tailwind mappings in `app/globals.css`; use classes such as `bg-background`, `text-foreground`, and `bg-primary`. Avoid scattering raw hex values across components. Preserve Nova's component conventions and existing radius scale unless a task needs a deliberate change. Dark mode is not an MVP requirement; retain existing support without expanding it, and verify any retained dark styles when theme tokens change.

## Layout, type, and components

- Use Geist for the interface and Geist Mono sparingly for identifiers/code.
- Use a simple hierarchy: page heading, section heading, body, supporting text. Keep body text around 16px with comfortable line height.
- Use a consistent 4px-based spacing rhythm, generous section spacing, aligned form fields, and restrained shadows.
- Reuse Nova buttons, cards, inputs, labels, and badges; inspect actual props before composing them.
- Use Lucide icons consistently, usually 16–20px. Label icon-only buttons accessibly.
- Use one clear primary action per section. Use secondary/outline actions for alternatives.
- Keep tables readable on small screens through deliberate scrolling or a simpler mobile layout.

## States and accessibility

Every interactive component needs clear focus, hover, disabled, and pending states. Every form needs visible labels, associated validation messages, and an obvious submission result. Include empty and error states for data views.

Do not communicate status by color alone: pair it with text and, when useful, an icon. Check at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful control boundaries/focus indicators. Ensure keyboard access and comfortable touch targets.

Use Motion for short, purposeful feedback or transitions, generally 150–250ms. Honor reduced-motion preferences. Avoid decorative continuous motion, excessive gradients, glow effects, and animation that hides essential content.

## Foundation tokens and verification

- `brand` / `brand-foreground` are for identity; `destructive` / `destructive-surface` are for errors. `success` / `success-surface` and `warning` / `warning-surface` pair readable text with tinted surfaces.
- `input` uses a stronger neutral boundary than decorative `border`; focus rings are opaque. Nova variants and radii are retained.
- The preview uses 44px-tall controls. Disabled and pending specimens are non-interactive; the validation example stays invalid intentionally. Static status messages use headings and icons without live announcements.
- Reduced motion suppresses transitions and active-button displacement; the pending icon spins only with `motion-safe`. Browser preference emulation is not available in the current verification tool, so the reduced-motion branch was reviewed in source rather than exercised under an OS preference.
- Browser checks covered 375px and 1280px layouts, keyboard order and focus, computed Geist families, and retained dark styling using a temporary root class that was removed after review.
