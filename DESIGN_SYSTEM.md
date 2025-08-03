# Livestorm-Inspired Design System

## Overview

This design system is inspired by Livestorm's professional, clean, and user-friendly interface patterns. It provides a comprehensive set of components, utilities, and design tokens for building modern video conferencing applications.

## Design Principles

### 1. **Clarity & Simplicity**
- Clear visual hierarchy with purposeful design elements
- Minimal cognitive load through intuitive interface patterns
- Consistent spacing and typography scales

### 2. **Professional Trust**
- Subtle shadows and refined interactions
- High-quality color palette with accessible contrast ratios
- Polished micro-interactions and animations

### 3. **Scalable System** 
- Component-based architecture
- Reusable design tokens and utilities
- Responsive design patterns

## Color System

### Primary Palette
- **Blue 600**: `#2563EB` - Primary actions, links, focus states
- **Blue 700**: `#1D4ED8` - Hover states for primary elements  
- **Blue 500**: `#3B82F6` - Secondary primary elements

### Semantic Colors
- **Success**: Emerald (`#059669`, `#047857`)
- **Warning**: Amber (`#D97706`, `#B45309`)
- **Error**: Red (`#DC2626`, `#B91C1C`)
- **Info**: Blue (`#2563EB`, `#1D4ED8`)

### Neutral Palette (Slate)
- **Slate 50-900**: Modern gray scale from `#F8FAFC` to `#0F172A`
- Used for backgrounds, text, borders, and subtle UI elements

## Typography Scale

```css
.text-display-xl     /* 48px, Bold, Tight Leading */
.text-display-lg     /* 36px, Bold, Tight Leading */
.text-display-md     /* 30px, Bold, Tight Leading */
.text-heading-xl     /* 24px, Semibold, Tight Leading */
.text-heading-lg     /* 20px, Semibold, Tight Leading */
.text-heading-md     /* 18px, Semibold, Snug Leading */
.text-body-lg        /* 16px, Normal, Relaxed Leading */
.text-body-md        /* 14px, Normal, Relaxed Leading */
.text-caption        /* 12px, Medium, Normal Leading */
```

## Component Library

### Cards
```css
.card                /* Standard card with subtle shadow */
.card-elevated       /* Enhanced shadow for important content */
.card-glass          /* Glassmorphism effect with backdrop blur */
.card-header         /* Header section with border */
.card-content        /* Main content area with padding */
.card-footer         /* Footer section with border */
```

### Buttons
```css
.btn                 /* Base button with focus states */
.btn-primary         /* Primary action button */
.btn-secondary       /* Secondary action button */
.btn-ghost           /* Minimal button for tertiary actions */
.btn-danger          /* Destructive actions */
.btn-success         /* Positive confirmation actions */
.btn-sm              /* Small button variant */
.btn-lg              /* Large button variant */
```

### Form Elements
```css
.input               /* Standard text input */
.input-error         /* Error state styling */
.input-success       /* Success state styling */
.input-group         /* Container for input + label */
.input-label         /* Form field labels */
.input-error-message /* Error message styling */
```

### Status Indicators
```css
.status-indicator    /* Base status badge */
.status-online       /* Online/active status */
.status-offline      /* Offline/inactive status */
.status-connecting   /* Loading/connecting status */
.status-error        /* Error status */
```

## Layout Utilities

### Containers & Grids
```css
.layout-container    /* Max-width container with responsive padding */
.layout-grid         /* Responsive grid layout */
.layout-flex-center  /* Centered flex container */
.layout-flex-between /* Space-between flex container */
```

### Video Interface
```css
.video-container     /* Video element wrapper */
.video-overlay       /* Gradient overlay for video */
.video-controls      /* Control bar with backdrop blur */
.participant-tile    /* Individual participant container */
.participant-info    /* Participant name overlay */
```

### Dashboard Components
```css
.dashboard-header    /* Dashboard header layout */
.dashboard-sidebar   /* Sidebar navigation */
.dashboard-main      /* Main content area */
.metrics-card        /* Metrics display card */
.metrics-value       /* Large metric number */
.metrics-label       /* Metric description */
```

## Interactive Elements

### Hover Effects
```css
.interactive-hover   /* Subtle scale and shadow on hover */
.interactive-press   /* Scale down effect on click */
```

### Animations
- **Duration**: 200ms for most transitions
- **Easing**: CSS `ease-out` for natural motion
- **Hover States**: Subtle scale (1.05x) and shadow enhancement
- **Loading States**: Spin animations for async operations

## Avatar System

```css
.avatar              /* Base avatar styling */
.avatar-sm           /* 32px avatar */
.avatar-md           /* 40px avatar */
.avatar-lg           /* 48px avatar */
.avatar-xl           /* 64px avatar */
.avatar-placeholder  /* Gradient background for initials */
```

## Notification System

```css
.notification-toast  /* Base toast notification */
.notification-success /* Success notification styling */
.notification-error  /* Error notification styling */
.notification-warning /* Warning notification styling */
.notification-info   /* Info notification styling */
```

## Loading States

```css
.skeleton            /* Skeleton loading animation */
.skeleton-text       /* Text skeleton placeholder */
.skeleton-circle     /* Circular skeleton (avatars, icons) */
```

## Accessibility Features

- **Focus Management**: Visible focus rings on all interactive elements
- **Color Contrast**: WCAG AA compliant contrast ratios
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Reduced Motion**: Respects `prefers-reduced-motion` setting

## Usage Examples

### Modern Card Layout
```jsx
<div className="card-elevated">
  <div className="card-header">
    <h2 className="text-heading-lg">Meeting Dashboard</h2>
    <StatusIndicator status="online" label="Live" />
  </div>
  <div className="card-content">
    <div className="layout-grid">
      <MetricCard value="24" label="Participants" />
      <MetricCard value="45m" label="Duration" />
    </div>
  </div>
</div>
```

### Professional Form
```jsx
<form className="space-y-6">
  <div className="input-group">
    <label className="input-label">Display Name</label>
    <input className="input" placeholder="Enter your name" />
  </div>
  <button className="btn btn-primary btn-lg w-full">
    Join Meeting
  </button>
</form>
```

## Integration Guide

1. **Import Styles**: All styles are included in `src/index.css`
2. **Use Components**: Apply utility classes to your JSX elements
3. **Follow Patterns**: Use established layout and component patterns
4. **Maintain Consistency**: Stick to the design token system

This design system ensures consistent, professional, and accessible user interfaces across the entire video conferencing application.