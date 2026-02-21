# Track Specification: Finish UI/UX Refinement and Branding Integration

## Context
The user has defined the Material Design 3 (M3) theme and UI patterns but needs to apply them consistently across all pages of the road accident admin panel.

## Goals
- Complete transition of all pages (Dashboard, Incidents, Reports, Settings) to M3.
- Ensure consistent use of the "Modern Purple" palette (Primary: #6750A4).
- Ensure consistent typography (Public Sans/Roboto) and components (Buttons, Cards, Inputs).
- Optimize for mobile responsiveness (touch targets, fluid layouts).

## Out of Scope
- Backend functionality implementations (unless required for UI display).
- Implementing new core features not already represented in the UI.

## Acceptance Criteria
- All pages use the defined `createAppTheme` and M3 components from `src/theme.ts`.
- Tailwind v4 utility classes correctly map to MUI theme variables.
- All buttons are fully rounded (`borderRadius: 100`).
- All cards have `borderRadius: 24` and appropriate M3 elevation shadows.
- Input fields have `12px` border radius and M3 styling.
- The application is fully responsive and usable on mobile devices.
