# Design System Documentation: Botanical Minimalism & The Artisan’s Lens

## 1. Overview & Creative North Star
**Creative North Star: The Digital Conservatory**

This design system moves away from the sterile, plastic nature of traditional SaaS "dashboards" and toward the feeling of a high-end apothecary or a master craftsman's studio. We are building a "Digital Conservatory"—a space that feels breathable, organic, and meticulously organized.

To achieve this, we reject the "standard grid" in favor of **Intentional Asymmetry** and **Tonal Depth**. The experience should feel like a premium editorial layout: high-contrast typography, generous negative space (white space), and a total absence of artificial structural lines. We replace "borders" with "light," using color shifts to guide the eye.

## 2. Colors: The Botanical Palette
Our palette is rooted in the deep greens of a manicured garden (`#003D2B`) and the warm, paper-like tones of a luxury salon (`#FFF8F1`).

### Core Tones
- **Primary (`primary_container` #003D2B):** Our anchor. Used for high-impact brand moments and primary actions.
- **Background (`background` #eefdee):** The canvas. This is a breathable, slightly tinted white that prevents eye strain and feels more "bespoke" than pure `#FFFFFF`.
- **Surface Tiers:**
    - `surface_container_lowest`: Pure white, used only for floating glass cards.
    - `surface_container_low`: The standard section background.
    - `surface_container_high`: To highlight specific interactive clusters.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or layout containment.
*   **The Method:** Boundaries must be defined solely through background color shifts. If a sidebar needs to be separated from a main view, use `surface_dim` for the sidebar against `surface_bright` for the content.
*   **Signature Textures:** For primary CTAs, do not use flat fills. Use a subtle linear gradient from `primary` (#002519) to `primary_container` (#003d2b) at a 45-degree angle. This adds "soul" and a tactile, silk-like finish.

## 3. Typography: The Editorial Scale
We pair the geometric precision of **Manrope** (English/Numerals) with the clean legibility of **Noto Sans TC** (Traditional Chinese).

*   **Display (3.5rem - 2.25rem):** Used for large, confident welcomes or daily revenue totals. Always set to tight letter-spacing (-0.02em).
*   **Headline & Title (2rem - 1rem):** The "Curator’s Voice." Use `on_background` (#121e15) to ensure authority.
*   **Body (1rem - 0.75rem):** Set in `on_surface_variant` (#404944) for a softer, more organic reading experience.
*   **The "Numerical Craftsman" Rule:** All pricing and time-slots must use Manrope Medium/SemiBold. The numbers are the "jewelry" of the app; treat them with high-contrast scale.

## 4. Elevation & Depth: Tonal Layering
In this system, we do not use shadows to create depth. Shadows are "artificial"; we prefer "organic layering."

*   **The Layering Principle:** Depth is achieved by stacking surface tiers. A `surface_container_lowest` card sitting on a `surface_container_low` background creates a natural, "paper-on-table" lift.
*   **The Ghost Border Fallback:** If a container absolutely requires a boundary for accessibility (e.g., an input field), use a "Ghost Border": the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.
*   **Glassmorphism & The Conservatory Effect:** For floating navigation or modals, use the `surface_container_lowest` color with a **70% opacity** and a **20px backdrop-blur**. This allows the botanical colors of the background to bleed through, softening the UI.

## 5. Components: Style & Execution

### Buttons (The Artisan's Interaction)
*   **Primary:** Gradient fill (Primary to Primary Container), 8px radius (`lg`), Manrope SemiBold. No shadow.
*   **Secondary:** `surface_variant` fill with `on_surface_variant` text.
*   **Tertiary:** No background, `on_surface` text with an underline that appears only on hover.

### Input Fields
*   **Form Factor:** Avoid the "box." Use a `surface_container_high` fill with a bottom-only "Ghost Border." 
*   **States:** On focus, the bottom border transforms into a 2px `primary` line. Labels should always be visible (never use placeholder-only layouts).

### Cards & Appointment Lists
*   **The Divider Prohibition:** Forbid the use of horizontal lines. To separate list items (e.g., a day’s schedule), use **Vertical White Space**.
*   **Spacing Scale:** Use the `xl` (0.75rem) or `lg` (0.5rem) spacing tokens to create "breathable groups." If separation is still needed, shift the background color of alternating items by 2%.

### Appointment "Leaf" Chips
*   **Visuals:** Use a 9999px (`full`) radius for status chips. 
*   **Success:** `on_secondary_container` text on `secondary_container` background.
*   **Terracotta (Error):** `on_error_container` text on `error_container` background.

### Salon-Specific Components
*   **The Stylist Grid:** Use asymmetrical card sizes to highlight "Top Performing Stylists."
*   **The Color Palette Picker:** A custom component for stylists to record hair dye formulas, utilizing the "Tonal Layering" principle to show swatches.

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts. A heavy left-aligned header with a right-aligned metric creates an editorial feel.
*   **Do** rely on Manrope for all data-heavy views. It is more legible for numbers than Noto Sans.
*   **Do** use the `surface_bright` and `surface_dim` tokens to define major app regions.

### Don’t
*   **Don't** use drop shadows. Ever. Depth is color, not darkness.
*   **Don't** use 1px solid borders. They feel "default" and "unconsidered."
*   **Don't** cram information. If a screen feels full, increase the page height and use more white space. A premium brand is never in a rush.
*   **Don't** use high-saturation reds for errors. Use the `terracotta` (#A84A3B) to maintain the botanical aesthetic.