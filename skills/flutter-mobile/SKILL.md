---
name: flutter-mobile
description: Flutter mobile development with widget composition, Riverpod state management, GoRouter navigation, platform channels, responsive layouts, theming, performance optimization, and testing
user-invokable: true
---

# Flutter Mobile Development

Build production-ready Flutter mobile apps with modern patterns, performance optimization, and comprehensive testing.

## Widget Composition

Extract widgets early. Const constructors everywhere possible.

BAD: Deeply nested, no extraction
```dart
class HomePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.home),
            SizedBox(width: 8),
            Text('Home'),
          ],
        ),
      ),
      body: ListView.builder(
        itemCount: items.length,
        itemBuilder: (context, index) {
          return Container(
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(child: Text(items[index].initial)),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(items[index].title),
                      Text(items[index].subtitle),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
```

GOOD: Extracted widgets, const constructors
```dart
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const HomeAppBar(),
      body: const ItemList(),
    );
  }
}

class HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  const HomeAppBar({super.key});

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.home),
          SizedBox(width: 8),
          Text('Home'),
        ],
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class ItemList extends StatelessWidget {
  const ItemList({super.key});

  @override
  Widget build(BuildContext context) {
    final items = context.watch(itemsProvider);
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) => ItemTile(item: items[index]),
    );
  }
}

class ItemTile extends StatelessWidget {
  const ItemTile({super.key, required this.item});

  final Item item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          CircleAvatar(child: Text(item.initial)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                Text(item.subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

## State Management with Riverpod

Use Riverpod for scalable state management. Avoid setState for complex state.

BAD: setState everywhere, no separation
```dart
class ProductScreen extends StatefulWidget {
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  List<Product> products = [];
  bool isLoading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    loadProducts();
  }

  Future<void> loadProducts() async {
    setState(() => isLoading = true);
    try {
      final response = await http.get(Uri.parse('https://api.example.com/products'));
      setState(() {
        products = (json.decode(response.body) as List)
            .map((e) => Product.fromJson(e))
            .toList();
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) return CircularProgressIndicator();
    if (error != null) return Text('Error: $error');
    return ListView(children: products.map((p) => Text(p.name)).toList());
  }
}
```

GOOD: Riverpod with async provider
```dart
// providers/product_provider.dart
@riverpod
class ProductNotifier extends _$ProductNotifier {
  @override
  Future<List<Product>> build() async {
    final repository = ref.watch(productRepositoryProvider);
    return repository.fetchProducts();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => ref.read(productRepositoryProvider).fetchProducts());
  }
}

// repositories/product_repository.dart
@riverpod
ProductRepository productRepository(ProductRepositoryRef ref) {
  return ProductRepository(ref.watch(httpClientProvider));
}

class ProductRepository {
  ProductRepository(this.client);
  final Dio client;

  Future<List<Product>> fetchProducts() async {
    final response = await client.get('/products');
    return (response.data as List).map((e) => Product.fromJson(e)).toList();
  }
}

// screens/product_screen.dart
class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      body: productsAsync.when(
        data: (products) => ListView.builder(
          itemCount: products.length,
          itemBuilder: (context, index) => ProductTile(product: products[index]),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => ErrorView(
          error: error,
          onRetry: () => ref.invalidate(productNotifierProvider),
        ),
      ),
    );
  }
}
```

## Navigation with GoRouter

Use GoRouter for declarative routing with type-safe navigation.

```dart
// lib/router/app_router.dart
@riverpod
GoRouter goRouter(GoRouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isAuthenticated = authState.valueOrNull?.isAuthenticated ?? false;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isAuthenticated && !isAuthRoute && state.matchedLocation != '/splash') {
        return '/auth/login';
      }
      if (isAuthenticated && isAuthRoute) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
        routes: [
          GoRoute(
            path: 'product/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return ProductDetailScreen(productId: id);
            },
          ),
        ],
      ),
    ],
  );
}

// Usage in widget
void navigateToProduct(String productId) {
  context.push('/home/product/$productId');
}
```

<!-- See references/advanced.md for extended examples -->
