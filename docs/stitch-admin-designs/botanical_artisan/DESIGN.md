# Design System Document: Botanical Minimalist Admin

## 1. Overview & Creative North Star: "The Verdant Atelier"
This design system is built for the premium hair salon environment—a space where craft meets organic beauty. The **Creative North Star** for this system is **"The Verdant Atelier."** 

Unlike generic administrative dashboards that feel clinical and rigid, this system treats the interface as a high-end editorial lookbook. We break the "software template" look through intentional asymmetry, generous negative space, and a "craftsman" approach to layout. Navigation elements use thin, hair-line borders (1px) to mimic architectural sketches, while content is organized through tonal layering rather than heavy boxes. The result is an experience that feels as curated as a botanical garden and as precise as a master stylist's cut.

---

## 2. Colors: Tonal Depth & Organic Contrast
The palette is rooted in deep forest greens and warm, paper-like neutrals. We avoid pure whites or blacks to maintain a premium, soft-touch aesthetic.

### Surface Hierarchy & Nesting
To achieve a high-end feel without using shadows, we rely on **Tonal Layering**. The UI is treated as a series of physical paper layers.
- **Base Layer:** `surface` (#FFF8F1) - The primary canvas.
- **Section Layer:** `surface_container_low` (#FAF2EA) - Used for grouping secondary content.
- **Interactive Layer:** `surface_container` (#F4EDE5) - For cards and input fields.
- **Nesting Rule:** To define importance, stack a `surface_container_lowest` (#FFFFFF) card on a `surface_container_low` section. This creates a "lifted" effect through color contrast alone.

### The "No-Shadow" Policy
Shadows are strictly prohibited. Visual separation is achieved via:
1. **The Glass & Gradient Rule:** For floating action buttons or high-priority CTAs, use a subtle gradient from `primary` (#002519) to `primary_container` (#003D2B). This adds "soul" and dimension without traditional elevation.
2. **Glassmorphism:** For top navigation bars or overlays, use `surface` with 80% opacity and a 20px backdrop-blur. This integrates the UI layers, making them feel like "frosted glass" resting on organic paper.

---

## 3. Typography: Editorial Authority
We pair **Manrope** for its modern geometric clarity with **Noto Sans TC** for seamless multi-language support.

- **Display & Headlines:** Use `display-md` or `headline-lg` with tight letter-spacing (-0.02em). These should be used sparingly to create "hero moments" in the admin experience (e.g., Daily Revenue or Stylist of the Month).
- **Titles:** `title-lg` and `title-md` act as the primary structural markers. Always use `on_surface` (#1E1B17) for high contrast against ivory backgrounds.
- **Body & Labels:** `body-md` is the workhorse. For metadata or "craftsman" details (e.g., appointment times), use `label-md` in `primary` (#003D2B) to draw the eye without overwhelming the layout.

---

## 4. Elevation & Depth: The Layering Principle
Depth is communicated through color shifts and "Ghost Borders."

- **The Ghost Border:** For navigation elements or tab bars, use a 1px border using `outline_variant` (#C0C9C2). To keep the look premium, reduce the opacity of these borders to 40%. They should be "felt, not seen."
- **Intentional Asymmetry:** Avoid perfectly centered grids. Align text-heavy content to the left with generous right-side margins (the "breathing room" principle) to mimic high-end magazine layouts.
- **Micro-Transitions:** When an element is pressed or active, transition the background from `surface_container` to `surface_dim`.

---

## 5. Components: The Craftsman’s Toolkit

### Buttons
- **Primary:** Solid `primary` (#002519) with `on_primary` (#FFFFFF) text. Border-radius: 6px.
- **Secondary:** 1px `outline` (#707974) border with no fill.
- **Tertiary:** Text-only in `primary`, used for low-emphasis actions like "Cancel."

### Input Fields
- **Styling:** Use `surface_container` (#F4EDE5) as the background with a 1px `outline_variant` bottom-border only. This mimics a physical ledger or salon appointment book.
- **Error State:** Border shifts to `error` (#BA1A1A) with helper text in `on_tertiary_fixed_variant`.

### Cards & Lists (The "No-Divider" Rule)
- **Rule:** Never use horizontal divider lines between list items.
- **Implementation:** Separate list items using 12px of vertical white space or by alternating background colors between `surface` and `surface_container_low`. 
- **Salon Context:** Appointment cards should use a `secondary_container` (#B6EDC2) left-accent bar to indicate "Confirmed" status.

### Specialized Components
- **The "Service Chip":** Small, pill-shaped chips using `primary_fixed` (#B7EFD4) backgrounds to categorize services (e.g., "Color," "Cut," "Treatment").
- **Timeline Indicator:** A 1px vertical line in `outline` used in the "Day View" to connect appointments, creating a sense of flow.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use `surface_bright` to highlight the "Active" stylist in a list.
- **Do** allow content to run off-edge in horizontal scrolls to suggest continuity.
- **Do** use high-contrast `display` type for numerical data (e.g., total salon occupancy).

### Don’t:
- **Don’t** use 100% black. Use `on_background` (#1E1B17) for all text.
- **Don’t** use drop shadows. If an element needs to pop, use a `primary_container` background.
- **Don’t** use sharp 0px corners. Stick strictly to the **4-8px radius** scale (0.25rem to 0.5rem) to maintain the "Soft Minimalist" feel.
- **Don’t** crowd the screen. On the iPhone 14 Pro, ensure a minimum of 24px side margins for all primary containers.

---

## 7. Device Specifications (iPhone 14 Pro)
- **Safe Zones:** Ensure all interactive elements (CTAs) stay within the bottom 30% of the screen for thumb-reachability.
- **Navigation:** The bottom tab bar uses a 1px `outline_variant` top-border and a `surface` background with 80% opacity and `backdrop-blur`. No icons should be "filled" unless active; use linear 1.5pt strokes for inactive states.