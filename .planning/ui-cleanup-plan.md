# UI/UX Cleanup Plan - Job Search Command Center

## Overview of Current State

The dashboard is a single-page application with:
- `index.html` (977 lines) - main structure
- `styles.css` (1122 lines) - all CSS
- `dashboard.js` (5758 lines) - monolithic JS with all UI logic
- `js/utils.js` (93 lines)
- `js/storage.js` (228 lines)
- `js/data.js` (320 lines)
- `js/documents.js` (378 lines)
- `js/analytics.js` (585 lines)

---

## CRITICAL ISSUES

### ISSUE 1: Zero Mobile Responsiveness
**Severity: Critical**

The `styles.css` file contains **zero `@media` queries**. The entire application has no responsive design at all. The main data table renders a 10-column HTML table that will overflow on any screen narrower than approximately 1200px.

Specific breakage on mobile/tablet:
- The 10-column jobs table overflows horizontally with no scroll container
- The `.container` has `max-width: 1400px` with fixed `padding: 20px` - no reduction on small screens
- The `.header-top` flex layout will not stack the title and button group vertically
- Modal content loses the close button on small screens
- The stats bar uses `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` causing overflow at 375px widths
- All font sizes are hardcoded in pixels throughout

### ISSUE 2: Massive Inline Style Abuse
**Severity: High**

There are **~223 inline `style=""` attributes** in `index.html` and **~277 inline `style=""` attributes** in `dashboard.js`. This makes the UI nearly impossible to maintain or theme consistently.

Color inconsistencies:
- Same gray tone appears as `#6c757d`, `#6b7280`, `#999`, `#9ca3af`, `#94a3b8`
- Same border color appears as `#e1e8ed`, `#e5e7eb`, `#e0e4e8`, `#d1d5db`

### ISSUE 3: Zero Accessibility Support
**Severity: High**

- **No ARIA roles on interactive widgets**: Tabs lack `role="tablist"`, `role="tab"`, `aria-selected`
- **No focus management**: When modals open, focus is not trapped
- **No `:focus` styles except on `.search-box`**
- **Color-only status indicators**: Status badges rely solely on color
- **No skip navigation link**
- **Table rows have `onclick` but no keyboard handlers**
- **Tooltips use CSS-only hover**

### ISSUE 4: Color Palette Inconsistency
**Severity: Medium**

At least 4 distinct gray scales that do not align:
- Bootstrap-era: `#6c757d`, `#495057`, `#333`
- Tailwind-era: `#6b7280`, `#374151`, `#1f2937`, `#9ca3af`
- Material-era: `#999`, `#f5f5f5`, `#ccc`
- Custom: `#e1e8ed`, `#f7f9fc`, `#e0e4e8`

### ISSUE 5: Duplicate Definitions and Conflicting Functions
**Severity: Medium**

- **Two `showToast` functions**: One in `js/utils.js` and another in `dashboard.js`
- **Two `formatDate` functions**: One in `js/utils.js` and another in `dashboard.js`
- **Duplicate `showNotification`**: `js/documents.js` has its own
- **Duplicate `@keyframes`**: Defined in CSS AND injected via JavaScript

### ISSUE 6: Poor Visual Hierarchy in Jobs Table
**Severity: Medium**

- All columns are equal weight visually
- Status badges are too small (12px font)
- Connection badges overflow and cause uneven row heights
- Fit scores lack visual impact (just colored text)
- No row grouping by status

### ISSUE 7: Modal Content Overload
**Severity: Medium**

The job detail modal generates ~250 lines of HTML with inline styles, requiring excessive scrolling. Should be organized into tabs or collapsible sections.

### ISSUE 8: Button Style Inconsistency
**Severity: Medium**

At least 5 different button styling patterns used. "Green/success" colors include: `#28a745`, `#059669`, `#22c55e`, `#10b981`.

---

## IMPROVEMENT PLAN

### TIER 1: Quick Wins (High Impact, Low Effort)

#### QW-1: Add CSS Custom Properties for Colors
Create `:root` block in `styles.css`:
```css
:root {
  --color-primary: #667eea;
  --color-primary-dark: #5568d3;
  --color-secondary: #764ba2;
  --color-success: #22c55e;
  --color-success-dark: #16a34a;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-danger-dark: #dc2626;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;
  --color-bg-surface: #ffffff;
  --color-bg-subtle: #f9fafb;
  --color-bg-muted: #f3f4f6;
}
```

#### QW-2: Add Basic Responsive Breakpoints
- At `max-width: 768px`: Stack header, reduce padding, hide low-priority columns
- At `max-width: 480px`: Single-column stats, smaller h1, scrollable tabs

#### QW-3: Add `:focus-visible` Styles
```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

#### QW-4: Remove Duplicate Function Definitions
Remove `showToast` and `formatDate` from `dashboard.js`, use `utils.js` versions.

#### QW-5: Remove Duplicate Keyframe Animations
Delete dynamically injected `@keyframes` from `dashboard.js`.

#### QW-6: Add Toast Styles to CSS
```css
.toast { /* base styles */ }
.toast.success { background: var(--color-success); }
.toast.error { background: var(--color-danger); }
.toast.info { background: var(--color-primary); }
```

---

### TIER 2: Medium Effort Improvements

#### ME-1: Extract Inline Styles into CSS Classes
Create semantic CSS classes for patterns that repeat:
- `.job-detail-header`
- `.fit-breakdown-container`
- `.connection-card`
- `.action-bar`
- etc.

#### ME-2: Add ARIA Attributes to Tab Component
- `role="tablist"` on `.tabs`
- `role="tab"`, `aria-selected`, `aria-controls` on each tab button
- `role="tabpanel"` on each content div

#### ME-3: Add Focus Trap to Modals
Create `trapFocus()` utility, restore focus on close.

#### ME-4: Improve Fit Score Visual
Replace plain text with circular indicators:
- 85+: Green circle
- 70-84: Orange circle
- Below 70: Red circle

#### ME-5: Responsive Table to Card Transformation
At <768px, transform table into card list.

#### ME-6: Consolidate Button Styles
```css
.btn { /* base */ }
.btn--primary { }
.btn--success { }
.btn--danger { }
.btn--ghost { }
.btn--sm { }
.btn--lg { }
```

#### ME-7: Consistent Loading/Error/Empty States
```css
.state-loading { }
.state-error { }
.state-empty { }
```

---

### TIER 3: Larger Refactors

#### LR-1: Job Detail Modal Redesign
Split into tabbed sections:
- Overview | Connections | Documents | History

#### LR-2: Design Token System
Spacing scale, font sizes, border radii, shadows, transitions.

#### LR-3: Pipeline View Redesign
Consider Kanban-style board as alternative view.

#### LR-4: Color Contrast Audit and Fix
Several combinations fail WCAG AA:
- `.status-maybe`: 3.15:1 (fails)
- `.status-probably-not`: 2.64:1 (fails)
- `.status-archived`: 2.85:1 (fails)

#### LR-5: Consistent Notification System
Replace `alert()` and `confirm()` with custom modal dialogs.

---

## IMPLEMENTATION SEQUENCE

Recommended order:
1. **QW-1** (CSS variables) - 30 minutes
2. **QW-4 + QW-5** (remove duplicates) - 15 minutes
3. **QW-6** (toast styles) - 15 minutes
4. **QW-3** (focus-visible) - 10 minutes
5. **QW-2** (responsive breakpoints) - 2-3 hours
6. **ME-6** (button system) - 1-2 hours
7. **ME-1** (extract inline styles) - 8-12 hours
8. **ME-4** (fit score visual) - 1 hour
9. **ME-2** (ARIA tabs) - 1 hour
10. **ME-3** (focus trap) - 1 hour
11. **ME-5** (responsive cards) - 3-4 hours
12. **ME-7** (loading states) - 1-2 hours
13. **LR-4** (contrast audit) - 2 hours
14. **LR-1** (modal redesign) - 4-6 hours
15. **LR-2** (design tokens) - 2-3 hours

---

## Status

- [ ] QW-1: CSS Variables
- [ ] QW-2: Responsive Breakpoints
- [ ] QW-3: Focus Styles
- [ ] QW-4: Remove Duplicate Functions
- [ ] QW-5: Remove Duplicate Keyframes
- [ ] QW-6: Toast CSS Classes
- [ ] ME-1: Extract Inline Styles
- [ ] ME-2: ARIA Tabs
- [ ] ME-3: Focus Trap
- [ ] ME-4: Fit Score Visual
- [ ] ME-5: Responsive Cards
- [ ] ME-6: Button System
- [ ] ME-7: Loading States
- [ ] LR-1: Modal Redesign
- [ ] LR-2: Design Tokens
- [ ] LR-3: Kanban View
- [ ] LR-4: Contrast Fixes
- [ ] LR-5: Notification System
