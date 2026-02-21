# Product Guidelines

## Visual Identity & Branding
The dashboard follows the **Material Design 3 (M3)** specification, adapted for a professional government administrative panel.

### Color Palette (Modern Purple)
- **Primary:** #6750A4 (Deep Purple) - Used for primary actions and key brand elements.
- **Secondary:** #625B71 - Used for less prominent UI components.
- **Tertiary:** #7D5260 - Used for accentuation and contrasting elements.
- **Background:** Optimized for both Light (#FEFBFF) and Dark/OLED (#000000) modes.
- **Surface:** #FFFFFF (Light) / #000000 (Dark) for cards and containers.

### Typography
- **Primary Font:** "Public Sans"
- **Fallback Fonts:** Roboto, Inter, sans-serif
- **Scale:** Adheres to M3 Typography Scale (Display, Headline, Title, Body, Label).

## UI Components & Patterns
- **Buttons:** Fully rounded (borderRadius: 100) following M3 style. Contained buttons use a subtle shadow on hover.
- **Cards:** Large rounded corners (borderRadius: 24) with a subtle border (1px solid).
- **Input Fields:** Outlined variants with 12px border radius.
- **Elevation:** Uses custom M3 elevation shadows (m3-elevation-1, m3-elevation-2) optimized for OLED displays.

## Development Standards
- **Styling:** Hybrid approach using **MUI (Material UI)** for component structure and **Tailwind CSS v4** for layout and utility-first styling.
- **CSS Variables:** All theme colors and typography scales are exposed as CSS variables for seamless integration between MUI and Tailwind.
- **Theming:** Support for both Light and Dark modes is mandatory. Dark mode must be OLED-optimized (true black).

## UX Principles
- **Clarity & Efficiency:** Administrative tasks (account management, data entry) must be streamlined and intuitive.
- **Real-time Feedback:** Use WebSockets for instant data updates, with clear visual indicators for new or modified records.
- **Responsive Design:** The interface must remain functional and legible across all device sizes, from desktop monitors to tablets and mobile phones.
- **Accessibility:** Ensure high contrast and clear labeling to meet government accessibility standards.

## Prose & Tone
- **Language:** Professional, formal, and precise.
- **Terminology:** Consistent use of terminology related to road accidents and government administration.
- **Feedback:** Clear and helpful error messages; concise success confirmations.
