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

<!-- See references/advanced.md for extended examples -->
