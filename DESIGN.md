# Tidyberrie design

Keep the app clean, calm, and cute. Give data visual priority and use decoration for context, feedback, and personality.

## Strawberry Milk

Default theme proposals. Components use semantic tokens and themes swap token values.

- `--bg` #FFF0F5, `--surface` #FFFFFF, `--soft` #FFE4E1
- `--accent-1` #FFD1DC, `--accent-2` #FFCAD4, `--accent-3` #FFB7C5
- `--primary` #C2456B, `--on-primary` #FFFFFF
- `--text` #4A2F38, `--text-muted` #8A6572, `--border` #F3CBD6
- `--success` #5E9C7A, `--warning` #D9952B, `--danger` #C0392B

## Sakura Night

Dark theme proposals. Set `--bg` to #2B1D25, `--surface` to #3A2832, `--primary` to #FF9DB5, and `--text` to #FDE9EF. Complete the remaining semantic tokens before implementation.

## Optional themes

Reserve these themes for later implementation as token sets only.

- **Cozy Cat Cafe** — Background #FFF8F0, surface #FFFFFF, accent #D9708A, latte #E8C9A0, text #4B3A33.
- **Matcha Berry** — Background #FFF5F7, surface #FFFFFF, accent #C2456B, sage #A8CDB4, text #3F2D34.
- **Lavender Cloud** — Background #FAF3FF, surface #FFFFFF, accent #B3568F, lilac #D9C7F0, text #45304A.
- **Mono Blush** — Background #FFFFFF, surface #FFF7F9, sole accent #C2456B, text #3A2A30.

All hex values are proposals. Verify WCAG AA contrast for every text/background pairing before shipping. Adjust muted text and other tokens where needed.

## Typography, layout, and motion

- Self-host Caveat and Nunito via @fontsource. Use Caveat sparingly for headings and Nunito for body text. Use tabular numerals for money and a 12/14/16/20/24/32 type scale.
- Use an 8-pt spacing grid and a soft shadow of `0 4px 16px rgba(194,69,107,0.10)`. Use radii of 16px for cards, 14px for buttons, and 999px for chips.
- Use the phone layout as the design target.
- Give each screen one primary action, represented by a floating “+” when adding is the primary action. Set key information in large type and supporting information in smaller, muted type.
- Use 150–250ms ease-out transitions and honor `prefers-reduced-motion`.

## Illustration and icons

- Use a cute girl avatar with separate transparent PNG or WebP poses for happy, cheering, sleepy, proud, and thinking moods.
- Use individual illustrated sticker icons at 48–96px for the task icon picker, empty states, and achievements. Cut them individually from the user's planner icon sheet in `design-source/` or generate new ones. Keep illustration clear of data.
- Use simple Lucide icons at 20–24px with a 1.75 stroke for navigation and buttons.

## Components

Button, Card, Chip, Checkbox, Progress bar or ring, Bottom sheet, Modal, Toast with Undo, Empty state, Tab bar, and Avatar with moods.

## Navigation and Home

Use five safe-area bottom tabs with filled icons and a pill for the active tab. Use the compact logo and clock on Home and stack soft token-based cards on the 8-pt grid. Keep stickers in empty states and the avatar. The floating add button opens the single enabled action directly or offers a short sheet when multiple actions are enabled.

- Categories use labeled icon and color chips, with archived names labeled on existing tasks. Category selection uses a sheet directly under the date controls. Category groups display completion counts and keep their collapsed state in the Tasks tab.
- Optional and time estimates use compact chips. A postponed card shows the original date with an icon and text.
- AppBars use a 56dp base, 20/24 title type, 48dp controls, and a border on scroll. Tasks adds a single row of 40dp chips inside 48dp targets and a filter sheet with draft, Reset, and Show results.
- Use Nunito outside the wordmark, 16/22 headings, 14–16 body, captions at 12 or above, 16dp card and screen padding, 12dp card gaps, and 16–24dp section gaps. Use the shared soft card surface, rounded corners, border, and shadow.
- Use 24dp bar icons and 20dp inline icons with 1.75 stroke. Preserve the focus ring, pressed feedback with reduced-motion support, readable disabled controls, matching loading placeholders, and Undo feedback.
- Scroll clearance includes the measured tab height, FAB, 16dp gap, and bottom inset. Move the FAB above the tab bar and hide it during keyboard resize.
