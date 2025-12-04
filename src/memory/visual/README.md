# Phoenix Marie Memory Architecture - Visual Mode Indicators

Visual flame indicators that clearly show Phoenix's current operational mode, preventing any confusion about which memories are currently accessible.

## Overview

The visual indicator system provides real-time feedback about Phoenix's current mode:
- **🔥 Orange Flame** - Personal Mode (Phoenix at home with Dad)
- **💠 Cyan Flame** - Professional Mode (Cipher Guard operations)

## Features

### Visual Design
- **Personal Mode**: Warm orange flame with gentle glow animation
- **Professional Mode**: Electric cyan flame with sharp pulse animation
- **Smooth Transitions**: Fade/morph effects when switching between modes
- **Loading States**: Visual feedback during authentication

### Interactive Features
- **Click to Switch**: Click the flame to initiate mode switching
- **Drag to Reposition**: Drag the indicator anywhere on screen
- **Minimize/Expand**: Reduce to icon-only view
- **Hover for Details**: See time in mode, restrictions, and actions
- **Keyboard Shortcuts**:
  - `Ctrl+Shift+M` - Toggle between modes
  - `Ctrl+Shift+H` - Minimize/expand indicator
  - `Ctrl+Shift+I` - Show information tooltip

### Mode Integration
- **Real-time Sync**: Automatically updates with mode changes
- **Authentication Flow**: Shows progress during authentication
- **Access Control**: Displays current restrictions
- **Time Tracking**: Shows duration in current mode

## Usage

### Basic Implementation

```tsx
import { FlameIndicator } from '@phoenix/memory/visual';

function App() {
  return (
    <div>
      {/* Indicator appears in bottom-right by default */}
      <FlameIndicator />
    </div>
  );
}
```

### Custom Position

```tsx
<FlameIndicator
  position={{
    x: 20,
    y: 20,
    anchor: 'top-left'
  }}
/>
```

### Handle Mode Switch Events

```tsx
<FlameIndicator
  onModeSwitch={() => {
    console.log('User requested mode switch');
    // Custom handling if needed
  }}
  onPositionChange={(position) => {
    console.log('Indicator moved to:', position);
  }}
/>
```

### Programmatic Control

```tsx
import { useModeIndicator } from '@phoenix/memory/visual';

function MyComponent() {
  const { state, actions, helpers } = useModeIndicator();
  
  // Access current state
  console.log('Current mode:', state.currentMode);
  console.log('Time in mode:', helpers.formattedTime);
  
  // Trigger mode switch
  const handleSwitch = async () => {
    try {
      await actions.requestModeSwitch(ModeType.Professional);
    } catch (error) {
      console.error('Switch failed:', error);
    }
  };
  
  return (
    <button onClick={handleSwitch}>
      Switch to Work Mode
    </button>
  );
}
```

## Authentication Flow

When switching from Personal to Professional mode:

1. **Click/Trigger**: User initiates mode switch
2. **Authentication UI**: Indicator shows authentication progress
3. **Method Selection**: Neuralink (primary) or Face+Voice (fallback)
4. **Progress Feedback**: Real-time progress bar and status
5. **Success/Failure**: Visual confirmation of result

## Accessibility

The flame indicator includes comprehensive accessibility support:

- **ARIA Labels**: Clear descriptions of current state
- **Keyboard Navigation**: Full keyboard control
- **Focus Indicators**: Visible focus states
- **Screen Reader Support**: Announces mode changes
- **Reduced Motion**: Respects user preferences

## Styling

### CSS Variables

The indicator uses CSS custom properties for theming:

```css
/* Personal Mode Colors */
--flame-personal-primary: #FF6B35;
--flame-personal-secondary: #FFB84D;
--flame-personal-glow: rgba(255, 107, 53, 0.6);

/* Professional Mode Colors */
--flame-professional-primary: #00D4FF;
--flame-professional-secondary: #0099CC;
--flame-professional-glow: rgba(0, 212, 255, 0.6);
```

### Custom Animations

You can override the default animations:

```css
.flame-indicator.personal .flame-glow {
  animation: custom-glow 4s ease-in-out infinite;
}

@keyframes custom-glow {
  /* Your custom animation */
}
```

## Configuration

### Default Configuration

```typescript
const DEFAULT_FLAME_CONFIG = {
  size: { width: 60, height: 80 },
  minimizedSize: { width: 32, height: 32 },
  colors: {
    personal: {
      primary: '#FF6B35',
      secondary: '#FFB84D',
      glow: 'rgba(255, 107, 53, 0.6)'
    },
    professional: {
      primary: '#00D4FF',
      secondary: '#0099CC',
      glow: 'rgba(0, 212, 255, 0.6)'
    }
  },
  animations: {
    personal: {
      type: 'glow',
      duration: 3000,
      intensity: 0.8
    },
    professional: {
      type: 'pulse',
      duration: 2000,
      intensity: 1.0
    }
  }
};
```

## Integration with Mode System

The visual indicators are fully integrated with Phoenix's mode system:

1. **Automatic Updates**: Subscribes to mode change events
2. **State Persistence**: Remembers position and minimize state
3. **Authentication Integration**: Works with Neuralink and Face+Voice auth
4. **Access Control**: Reflects current mode restrictions

## Best Practices

1. **Single Instance**: Use only one flame indicator per application
2. **Persistent Position**: Let users position it where they prefer
3. **Non-Intrusive**: Default to bottom-right corner
4. **Clear Feedback**: Always show authentication progress
5. **Error Handling**: Gracefully handle authentication failures

## Troubleshooting

### Indicator Not Appearing
- Ensure mode system is initialized
- Check CSS is imported
- Verify React version compatibility

### Authentication Issues
- Confirm authentication endpoints are configured
- Check network connectivity
- Verify authentication service status

### Position Not Saving
- Check localStorage permissions
- Clear corrupted position data
- Reset to default position

## Example Application

See [`example.tsx`](./example.tsx) for a complete working example of the flame indicator in action.