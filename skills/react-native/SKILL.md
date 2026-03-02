---
name: react-native
description: Expert React Native mobile development for iOS and Android. Covers Expo vs bare workflow, navigation patterns, performance optimization, native modules, and platform-specific code.
user-invokable: true
---

# React Native Mobile Development

Expert guidance for building production-ready React Native applications. Covers architecture decisions, performance optimization, navigation, state management, and native integration.

## Project Setup and Workflow Selection

**BAD: Starting with bare workflow without justification**
```bash
npx react-native init MyApp
# Adds unnecessary native complexity from day one
# Requires Xcode/Android Studio setup immediately
```

**GOOD: Start with Expo, eject only when needed**
```bash
npx create-expo-app@latest MyApp --template blank-typescript
cd MyApp

# Expo provides:
# - Instant dev environment (no Xcode/Android Studio)
# - OTA updates via EAS
# - Prebuild for native customization
# - Standard libraries (camera, location, etc.)

# When you need custom native code:
npx expo prebuild
# Generates ios/ and android/ directories
# Maintains Expo libraries, adds native flexibility
```

When to use bare workflow:
- Heavy native module customization required
- Existing native iOS/Android codebase integration
- Libraries incompatible with Expo (rare in 2026)

## Navigation Architecture

**BAD: Navigation without type safety or deep linking**
```tsx
// No type checking on navigation params
function HomeScreen({ navigation }) {
  return (
    <Button
      title="Go to Profile"
      onPress={() => navigation.navigate('Profile', { userId: '123' })}
      // Typo in route name causes runtime crash
    />
  );
}
```

**GOOD: React Navigation with TypeScript and deep linking**
```tsx
// types/navigation.ts
import { NavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: { section?: 'privacy' | 'notifications' };
};

export type AppNavigation = NavigationProp<RootStackParamList>;

// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['myapp://', 'https://myapp.com'],
  config: {
    screens: {
      Home: '',
      Profile: 'user/:userId',
      Settings: 'settings/:section?',
    },
  },
};

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// HomeScreen.tsx
import { useNavigation } from '@react-navigation/native';
import type { AppNavigation } from './types/navigation';

function HomeScreen() {
  const navigation = useNavigation<AppNavigation>();

  return (
    <Button
      title="Go to Profile"
      onPress={() => navigation.navigate('Profile', { userId: '123' })}
      // TypeScript validates route name and params
    />
  );
}
```

Tab navigation pattern:
```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = route.name === 'Home' ? 'home' : 'settings';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#d4943a',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
```

## List Performance Optimization

**BAD: ScrollView for long lists, no optimization**
```tsx
function ProductList({ products }) {
  return (
    <ScrollView>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
        // Renders ALL items immediately
        // No virtualization, causes memory issues
      ))}
    </ScrollView>
  );
}

function ProductCard({ product }) {
  const styles = {
    container: { padding: 16 }, // Inline styles
  };
  return <View style={styles.container}>...</View>;
  // Re-creates style object on every render
}
```

**GOOD: FlatList with full optimization**
```tsx
import { FlatList, StyleSheet } from 'react-native';
import { memo } from 'react';

const ITEM_HEIGHT = 100;

function ProductList({ products }) {
  const renderItem = ({ item }) => <ProductCard product={item} />;

  const keyExtractor = (item) => item.id;

  const getItemLayout = (data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      // Skip measurement, instant scroll

      windowSize={10}
      // Render 10 screen heights worth of items

      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      // Batch rendering for smooth scroll

      removeClippedSubviews={true}
      // Unmount off-screen items (Android optimization)
    />
  );
}

const ProductCard = memo(({ product }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.price}>${product.price}</Text>
    </View>
  );
});
// React.memo prevents unnecessary re-renders

const styles = StyleSheet.create({
  container: { padding: 16, height: ITEM_HEIGHT },
  title: { fontSize: 16, fontWeight: 'bold' },
  price: { fontSize: 14, color: '#666' },
});
// StyleSheet.create optimizes style objects
```

## State Management with Zustand and React Query

**BAD: Mixing server and client state in context**
```tsx
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
    // No loading states, error handling, or caching
    // Re-fetches on every mount
  }, []);

  return (
    <AppContext.Provider value={{ user, setUser, products }}>
      {children}
    </AppContext.Provider>
  );
}
```

**GOOD: Zustand for client state, React Query for server state**
```tsx
// store/auth.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: AsyncStorage,
    }
  )
);

// api/products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProducts() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetch('/api/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Auto-caching, background refetch, error handling
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Product) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Auto-refetch products after create
    },
  });
}

// ProductsScreen.tsx
function ProductsScreen() {
  const { data: products, isLoading, error } = useProducts();
  const createProduct = useCreateProduct();

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;

  return <FlatList data={products} {...} />;
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Navigation />
    </QueryClientProvider>
  );
}
```

## Platform-Specific Code

**BAD: Runtime checks everywhere, duplicate code**
```tsx
function Header() {
  if (Platform.OS === 'ios') {
    return <View style={{ paddingTop: 44 }}>...</View>;
  } else {
    return <View style={{ paddingTop: 24 }}>...</View>;
  }
  // Conditional rendering creates maintenance burden
}
```

**GOOD: Platform.select and platform-specific files**
```tsx
// styles.ts
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.select({
      ios: 44,
      android: 24,
      default: 20,
    }),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// For complex platform differences, use separate files:
// Button.ios.tsx
export function Button({ title, onPress }) {
  return <Pressable style={iosStyles.button} onPress={onPress}>...</Pressable>;
}

// Button.android.tsx
export function Button({ title, onPress }) {
  return <TouchableNativeFeedback onPress={onPress}>...</TouchableNativeFeedback>;
}

// Import automatically selects correct platform file:
import { Button } from './Button';
```

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
