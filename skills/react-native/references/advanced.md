# React Native Advanced Patterns

## Animations with Reanimated

**BAD: Animated API causing JS thread blocking**
```tsx
function FadeIn({ children }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
  // Animated API works but less performant than Reanimated
}
```

**GOOD: Reanimated for native 60fps animations**
```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

function FadeIn({ children }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    // Runs entirely on UI thread
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

// Gesture-based animation:
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

function DraggableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>Drag me!</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

## Image Optimization and Caching

**BAD: No caching, full-size images**
```tsx
function ProductImage({ url }) {
  return <Image source={{ uri: url }} style={{ width: 300, height: 300 }} />;
  // No caching, re-downloads on every mount
  // Loads full-size image even for thumbnail
}
```

**GOOD: Expo Image with caching and optimization**
```tsx
import { Image } from 'expo-image';

function ProductImage({ url }) {
  return (
    <Image
      source={{ uri: url }}
      style={{ width: 300, height: 300 }}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
      // Auto-caches to disk, smooth fade-in

      placeholder={require('./assets/placeholder.png')}
      // Show placeholder while loading
    />
  );
}

// For remote images, use CDN resizing:
function OptimizedImage({ url, width, height }) {
  const dpr = PixelRatio.get();
  const optimizedUrl = `${url}?w=${width * dpr}&h=${height * dpr}&fit=cover`;

  return (
    <Image
      source={{ uri: optimizedUrl }}
      style={{ width, height }}
      cachePolicy="memory-disk"
    />
  );
}
```

## Native Modules with Turbo Modules

**BAD: Legacy native modules (old architecture)**
```tsx
// Requires manual setup, slower bridge communication
import { NativeModules } from 'react-native';
const { CalendarModule } = NativeModules;

CalendarModule.createEvent('Party', '2026-03-15');
// Asynchronous bridge calls, serialization overhead
```

**GOOD: Turbo Modules (new architecture)**
```tsx
// Install Expo config plugin or create Turbo Module:
// MyModule.ts (TypeScript spec)
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  createEvent(name: string, date: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MyModule');

// Usage:
import MyModule from './MyModule';

async function scheduleEvent() {
  const eventId = await MyModule.createEvent('Party', '2026-03-15');
  // Type-safe, faster than legacy bridge
  // Lazy-loaded, synchronous methods available
}

// For Expo, prefer config plugins:
// app.json
{
  "expo": {
    "plugins": [
      ["expo-camera", { "cameraPermission": "Allow access to camera" }]
    ]
  }
}
```

## Debugging and Performance Monitoring

**BAD: console.log debugging, no profiling**
```tsx
function fetchData() {
  console.log('Fetching data...');
  fetch('/api/data').then(data => {
    console.log('Data received:', data);
    // No structured logging, no performance tracking
  });
}
```

**GOOD: Flipper integration and Hermes profiling**
```tsx
// Enable Flipper for debugging (included in Expo Dev Client):
// - Network inspector
// - React DevTools
// - Layout inspector
// - Logs

// Use Hermes for JavaScript performance:
// metro.config.js
module.exports = {
  transformer: {
    hermesCommand: 'hermes',
  },
};

// Profile with Hermes:
// 1. Enable Hermes sampling profiler in dev menu
// 2. Perform actions to profile
// 3. Download profile and open in Chrome DevTools

// Structured logging:
import { logger } from './utils/logger';

async function fetchData() {
  const start = performance.now();

  try {
    const data = await fetch('/api/data').then(r => r.json());
    logger.info('Data fetched', {
      duration: performance.now() - start,
      itemCount: data.length,
    });
    return data;
  } catch (error) {
    logger.error('Fetch failed', { error, duration: performance.now() - start });
    throw error;
  }
}

// Performance monitoring with React DevTools Profiler:
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration) {
  logger.info('Render performance', { id, phase, actualDuration });
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Navigation />
    </Profiler>
  );
}
```

## Production Build Optimization

Build checklist:
```bash
# 1. Enable Hermes (default in Expo SDK 50+)
# 2. Optimize bundle size
npx expo-doctor

# 3. Configure proguard (Android) and bitcode (iOS)
# android/app/build.gradle
buildTypes {
  release {
    minifyEnabled true
    proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
  }
}

# 4. Build and test release version
eas build --platform android --profile production
eas build --platform ios --profile production

# 5. Monitor with Sentry or similar
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_DSN',
  enableNative: true,
  tracesSampleRate: 1.0,
});
```

Common performance issues:
- Using ScrollView instead of FlatList for long lists
- Not memoizing components or callbacks in FlatList renderItem
- Inline styles instead of StyleSheet.create
- No image caching strategy
- Running expensive operations on JS thread instead of worklets
- Not using getItemLayout for fixed-size list items
- Deep component trees without optimization

React Native excels at: cross-platform mobile apps, rapid prototyping, code sharing with web (react-native-web), hot reload iteration, JavaScript/TypeScript ecosystem leverage.
