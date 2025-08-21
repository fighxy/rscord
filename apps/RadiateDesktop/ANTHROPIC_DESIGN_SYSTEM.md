# Anthropic/Claude Design System for rscord

## Overview

This design system is inspired by Anthropic's visual identity and Claude's interface, emphasizing warmth, academic rigor, and human-centered design. It replaces the previous Discord-like styling with a sophisticated, approachable aesthetic that reflects Anthropic's commitment to AI safety and thoughtful development.

## Design Principles

### 1. **Warmth over Tech Coldness**
- Uses warm color palette (#b05730 orange-brown, #f0eee5 warm off-white)
- Avoids typical tech blues and neons
- Creates an inviting, paper-like foundation

### 2. **Academic Rigor**
- Subtle shadows and sophisticated contrast ratios
- Clean typography inspired by Styrene/Tiempos pairing
- Purposeful spacing and organized information hierarchy

### 3. **Human-Centered Interaction**
- Gentle animations and transitions
- Accessible focus states and high contrast support
- Thoughtful hover effects that enhance usability

### 4. **Sophisticated Restraint**
- Rounded corners without being overly playful
- Minimal decoration in favor of functional clarity
- Purposeful visual elements that support content

## Color System

### Brand Colors
- **Primary Orange**: `#b05730` - Anthropic's signature warm orange-brown
- **Primary Hover**: `#9e4a28` - Darker variant for interactive states
- **Secondary Purple**: `#6c5dac` - Muted purple accent
- **Light Orange**: `#d97706` - Supporting orange tone

### Background System
- **Primary**: `#f0eee5` - Warm off-white main background
- **Secondary**: `#faf9f7` - Lighter warm surfaces
- **Elevated**: `#ffffff` - Cards and modal backgrounds
- **Input**: `#fefdfb` - Form field backgrounds

### Text Hierarchy
- **Primary**: `#1a1a1a` - Headlines and primary content
- **Secondary**: `#4a4a4a` - Body text and descriptions
- **Tertiary**: `#6b6b6b` - Captions and metadata
- **Muted**: `#8a8a8a` - Placeholders and disabled text

### Semantic Colors
- **Success**: `#059669` - Positive actions and success states
- **Warning**: `#d97706` - Cautions and warnings
- **Error**: `#dc2626` - Errors and destructive actions
- **Info**: `#2563eb` - Information and neutral actions

## Typography

### Font Stack
```css
--font-sans: 'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code Variable', 'Fira Code', 'SF Mono', Consolas, monospace;
```

### Scale
- **xs**: 12px - Small UI text, badges
- **sm**: 14px - Body text, form labels
- **base**: 16px - Default size
- **lg**: 18px - Section headings
- **xl**: 20px - Page titles
- **2xl**: 24px - Hero headings

## Layout System

### Grid Structure
The application uses a 4-column grid inspired by Claude's interface:
```css
grid-template-columns: 80px 320px 1fr 360px;
```

1. **Guild Bar** (80px) - Server/workspace navigation
2. **Sidebar** (320px) - Channel/conversation list
3. **Main Content** (1fr) - Chat/primary content area
4. **Members Panel** (360px) - Artifacts-inspired side panel

### Spacing Scale
- **1**: 4px - Tight spacing
- **2**: 8px - Small gaps
- **3**: 12px - Default spacing
- **4**: 16px - Medium spacing
- **5**: 20px - Large spacing
- **6**: 24px - Section spacing

## Component Library

### Buttons
```html
<!-- Primary button -->
<button class=\"btn btn-primary\">Send Message</button>

<!-- Secondary button -->
<button class=\"btn btn-secondary\">Cancel</button>

<!-- Ghost button -->
<button class=\"btn btn-ghost\">More Options</button>

<!-- Icon button -->
<button class=\"btn btn-icon\">
  <svg>...</svg>
</button>
```

### Input Fields
```html
<!-- Standard input -->
<input class=\"input\" type=\"text\" placeholder=\"Type a message...\">

<!-- Textarea -->
<textarea class=\"textarea\" placeholder=\"Enter description...\"></textarea>

<!-- Input with error state -->
<input class=\"input input-error\" type=\"email\">
```

### Cards
```html
<!-- Basic card -->
<div class=\"card\">
  <div class=\"card-header\">
    <h3 class=\"card-title\">Card Title</h3>
    <p class=\"card-description\">Description text</p>
  </div>
  <div class=\"card-body\">
    Content goes here
  </div>
</div>

<!-- Interactive card -->
<div class=\"card card-interactive\">
  Clickable card content
</div>
```

### Badges
```html
<span class=\"badge\">Default</span>
<span class=\"badge badge-success\">Online</span>
<span class=\"badge badge-warning\">Away</span>
<span class=\"badge badge-error\">Offline</span>
```

### Avatars
```html
<div class=\"avatar avatar-md\">
  <img src=\"avatar.jpg\" alt=\"User\">
  <div class=\"avatar-status online\"></div>
</div>
```

### Messages
```html
<!-- User message -->
<div class=\"message message-user\">
  <div class=\"message-bubble-user\">
    User message content
  </div>
</div>

<!-- Assistant message -->
<div class=\"message message-assistant\">
  <div class=\"message-bubble-assistant\">
    Assistant response with longer content and multiple lines
  </div>
</div>
```

## Animation & Interaction

### Timing Functions
- **Fast**: 150ms - Quick feedback
- **Base**: 200ms - Standard transitions
- **Slow**: 300ms - Complex animations
- **Easing**: `cubic-bezier(0, 0, 0.2, 1)` - Natural motion

### Hover Effects
- Subtle `translateY(-1px)` elevation
- Shadow enhancement for depth
- Color transitions for feedback

### Focus States
- Orange outline (`#b05730`) with 3px offset
- High contrast support via media queries
- Keyboard navigation friendly

## Dark Mode Support

The system includes comprehensive dark mode support while maintaining the warm Anthropic aesthetic:

```css
.dark {
  --bg-primary: #1a1a1a;
  --text-primary: #f5f5f5;
  --anthropic-orange: #e67e22; /* Adjusted for dark backgrounds */
  /* ... additional dark mode variables */
}
```

## Accessibility Features

### High Contrast Mode
```css
@media (prefers-contrast: high) {
  /* Enhanced contrast ratios */
  /* Thicker borders and outlines */
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Disabled animations */
  /* Instant transitions */
}
```

### Screen Reader Support
- Semantic HTML structure
- Proper ARIA labels and roles
- Focus management for modals and dropdowns

## Usage Guidelines

### Do's
✅ Use the warm orange (#b05730) for primary actions
✅ Maintain consistent spacing using the scale
✅ Apply subtle shadows for depth and hierarchy
✅ Use the Inter font family for consistency
✅ Implement proper focus states for accessibility

### Don'ts
❌ Don't use cold blues or neon colors
❌ Avoid harsh shadows or dramatic effects
❌ Don't override the border radius system
❌ Avoid mixing different font families
❌ Don't ignore accessibility requirements

## File Structure

```
src/styles/
├── theme.css              # Core variables and base styles
├── components/
│   ├── index.css          # Component imports and utilities
│   ├── buttons.css        # Button variants and states
│   ├── inputs.css         # Form controls and inputs
│   └── cards.css          # Card components and layouts
└── App.css               # Main stylesheet with imports
```

## Getting Started

1. Import the design system in your component:
```javascript
import './App.css';
```

2. Use CSS classes for consistent styling:
```jsx
<button className=\"btn btn-primary\">
  Send Message
</button>
```

3. Leverage CSS custom properties for theming:
```css
.custom-component {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
}
```

## Responsive Design

The system includes responsive breakpoints:
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px  
- **Desktop**: > 1024px

Layout adapts gracefully with collapsing sidebars and stacked navigation on smaller screens.

---

This design system brings Anthropic's thoughtful, human-centered approach to the rscord interface, creating a warm and accessible communication platform that reflects the values of AI safety and careful development.