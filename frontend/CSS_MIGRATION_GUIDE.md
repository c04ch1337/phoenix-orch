# CSS Migration Guide: globals.css to Tailwind

This guide documents the migration of custom CSS from `globals.css` to pure Tailwind solutions, as part of our CSS audit.

## What Was Migrated

The following custom CSS elements were migrated from globals.css:

1. **CSS Variables** - Moved to Tailwind theme colors
2. **Custom Scrollbar** - Converted to a Tailwind component
3. **Animations** (glitch, shimmer, etc.) - Moved to Tailwind keyframes/animations
4. **Typography Styles** - Converted to custom Tailwind utilities
5. **Visual Effects** (gradients, glows) - Created as Tailwind components
6. **Utility Classes** - Added to Tailwind plugins

## How to Apply Migrated Styles

### Base Styles (font, background, etc.)

```tsx
// Before (with globals.css)
<div className="some-other-class">...</div>

// After (with Tailwind)
<div className="bg-phoenix-void text-white font-rajdhani">...</div>
```

### Custom Scrollbars

```tsx
// Before (with globals.css)
<div className="custom-scrollbar">...</div>

// After (with Tailwind - same class name, but defined as a component)
<div className="custom-scrollbar">...</div>
```

### Animations

```tsx
// Before (with globals.css)
<div className="glitch-active">...</div>

// After (with Tailwind)
<div className="animate-glitch">...</div>
```

### Phoenix Console

```tsx
// Before (with globals.css)
<div className="phoenix-console">...</div>

// After (with Tailwind - same class name, but defined as a component)
<div className="phoenix-console">...</div>
```

### Digital Twin Panel

```tsx
// Before (with globals.css)
<div className="digital-twin-panel">...</div>

// After (with Tailwind - same class name, but defined as a component)
<div className="digital-twin-panel">...</div>
```

### Fire Text Effect

```tsx
// Before (with globals.css)
<span className="fire-text">Phoenix</span>

// After (with Tailwind - same class name, but defined as a component)
<span className="fire-text">Phoenix</span>
```

### Phoenix Rain Canvas

```tsx
// Before (with globals.css)
<canvas className="phoenix-rain">...</canvas>
<canvas className="phoenix-rain white-hot">...</canvas>

// After (with Tailwind - same class names, but defined as components)
<canvas className="phoenix-rain">...</canvas>
<canvas className="phoenix-rain white-hot">...</canvas>
```

### Typography Utilities

```tsx
// Before (with globals.css)
<h1 className="font-orbitron">Heading</h1>
<code className="font-jetbrains">console.log('hello')</code>
<div className="font-covenant">Signed</div>

// After (with Tailwind - same class names, but defined as utilities)
<h1 className="font-orbitron">Heading</h1>
<code className="font-jetbrains">console.log('hello')</code>
<div className="font-covenant">Signed</div>
```

### Clip Path Utilities

```tsx
// Before (with globals.css)
<div className="clip-trapezoid-top">...</div>
<div className="clip-trapezoid-bottom">...</div>

// After (with Tailwind)
<div className="clip-trapezoid-top">...</div>
<div className="clip-trapezoid-bottom">...</div>
```

### Shadow Effects

```tsx
// Before (with globals.css)
<div className="shadow-red-glow">...</div>

// After (with Tailwind)
<div className="drop-shadow-red-glow">...</div>
```

## Using with clsx or cn

For conditional application of these classes, use `clsx` or a custom `cn` helper:

```tsx
import { clsx } from 'clsx';
// or
import { cn } from '@/lib/utils'; // If you have a custom cn utility

function MyComponent({ isActive }) {
  return (
    <div
      className={clsx(
        "phoenix-console", // Base component
        isActive && "animate-glitch", // Conditional animation
      )}
    >
      Content
    </div>
  );
}
```

## Benefits of the Migration

1. **Consistent styling system** - All styles now use Tailwind's design system
2. **Improved performance** - Smaller CSS bundle with better tree-shaking
3. **Better developer experience** - Consistent API for styling components
4. **Maintainable code** - Styles are co-located with their usage
5. **Type safety** - When used with tools like tailwind-merge and clsx

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Plugin API](https://tailwindcss.com/docs/plugins)