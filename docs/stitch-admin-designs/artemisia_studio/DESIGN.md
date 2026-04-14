# Design System Strategy: The Artisanal Atoll

## 1. Overview & Creative North Star: "The Botanical Curatorship"
This design system moves away from the sterile, "software-as-a-service" aesthetic and toward the feel of a high-end, independent editorial magazine. The Creative North Star is **The Botanical Curatorship**. It treats the solo salon admin app not as a utility, but as a digital workspace that feels like a physical studio—calm, intentional, and grounded in craft.

To break the "template" look, we leverage **Intentional Asymmetry**. Instead of perfectly centered grids, we use generous, unequal margins and "staggered" content blocks. High-contrast typography scales (pairing massive display text with tiny, breathable labels) create an authoritative yet airy presence.

---

## 2. Colors: Tonal Depth & Organic Pigment
Our palette is derived from nature—deep evergreens, sun-bleached paper, and kiln-fired clay. We move beyond flat UI by treating color as a physical material.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
*   *Example:* A `surface-container-low` section sitting on a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as layered sheets of handmade paper. Use the surface-container tiers to define importance:
*   **Background (#FFF8F1):** The canvas.
*   **Surface (#F3ECE4):** The primary workspace.
*   **Surface-Container-Lowest:** Used for the most "elevated" content, like an active appointment card.
*   **Surface-Container-Highest:** Used for "sunken" utility areas, like a search bar or footer.

### The Glass & Texture Rule
To add visual "soul," use **Glassmorphism** for floating navigation or overlays. Utilize semi-transparent versions of `primary_container` (#003D2B at 85% opacity) with a `backdrop-blur` of 12px. For main CTAs, apply a subtle linear gradient from `primary` (#002519) to `primary_container` (#003D2B) at a 45-degree angle to mimic the depth of forest foliage.

---

## 3. Typography: The Editorial Voice
We utilize **Manrope** for its modern, geometric clarity and **Noto Sans TC** for seamless multilingual integration.

*   **Display (L/M/S):** Large, confident, and tight-kerning. Use for "Welcome" messages or daily revenue totals.
*   **Headline (L/M/S):** The "Chapter Titles" of the app. Use these to anchor sections without needing heavy dividers.
*   **Body (L/M):** Optimized for readability in `on_surface_variant` (#404944). This is the workhorse for client notes and service descriptions.
*   **Label (M/S):** All-caps with a +5% letter-spacing. Use these for metadata (e.g., "APPOINTMENT TIME" or "PRODUCT STOCK").

The contrast between a `display-lg` header and a `label-sm` metadata tag creates a "high-fashion" hierarchy that feels premium and curated.

---

## 4. Elevation & Depth: Tonal Layering
Since shadows are prohibited, we create depth through "The Layering Principle."

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a soft, natural lift via color value rather than artificial drop shadows.
*   **The "Ghost Border" Fallback:** If a border is essential for accessibility (e.g., in high-contrast modes), use the `outline_variant` token at **15% opacity**. Never use 100% opaque borders.
*   **Glassmorphism Depth:** For "Action Sheets" or "Modals," use `surface_bright` with a 0.9 opacity and a heavy blur. This makes the layout feel integrated and organic, allowing the "botanical" colors of the background to bleed through.

---

## 5. Components: Minimalist Primitives

### Buttons
*   **Primary:** `primary_container` (#003D2B) background, `on_primary` (#FFFFFF) text. Radius: 6px. No shadow.
*   **Secondary:** `surface_variant` background, `on_surface` text. Feels like a subtle indentation on the page.
*   **Tertiary:** No background. Text in `primary`. Use for low-emphasis actions like "Cancel."

### Input Fields
*   **Styling:** Remove all four borders. Use a bottom-only "Ghost Border" (15% `outline`) or a solid `surface_container_high` background with a 4px top-radius. 
*   **Focus State:** The bottom border transforms into a 2px `primary` line.

### Cards & Lists (The "No Divider" Rule)
*   **Rule:** Forbid the use of horizontal divider lines. 
*   **Execution:** Separate list items using `spacing-md` (16px) of vertical white space or by alternating background colors between `surface` and `surface_container_low`.

### Specialized Salon Components
*   **The Appointment Blotter:** A card component using `surface_container_lowest`. It uses a "Terracotta Red" (#A84A3B) vertical accent strip (4px wide) on the left to denote "High Priority" or "VIP" clients.
*   **Status Pills:** Use `secondary` (#376847) for "Confirmed" and `tertiary_container` (#65190f) for "Cancelled," but keep the background opacity at 10% to maintain the calm, minimalist vibe.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins (e.g., 24px left, 48px right) to create an artisanal, non-standard layout.
*   **Do** rely on the Typography Scale to move the eye. A large font size is a better "separator" than a line.
*   **Do** use `tertiary_fixed` (#ffdad4) for soft, warm alerts that don't cause panic.

### Don't
*   **Don't** use shadows. If you feel a component "needs" a shadow, use a darker background color behind it instead.
*   **Don't** use standard "Success Green" or "Error Red." Stick strictly to the `Success` (#4A7C59) and `Terracotta Red` (#A84A3B) tokens.
*   **Don't** crowd the interface. If the screen feels busy, double the white space between sections.