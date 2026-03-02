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

## Platform Channels

Bridge native code for platform-specific features.

```dart
// lib/services/native_service.dart
class NativeService {
  static const platform = MethodChannel('com.example.app/native');

  Future<String> getDeviceId() async {
    try {
      final String deviceId = await platform.invokeMethod('getDeviceId');
      return deviceId;
    } on PlatformException catch (e) {
      throw Exception('Failed to get device ID: ${e.message}');
    }
  }

  Future<void> openNativeCamera() async {
    try {
      await platform.invokeMethod('openCamera', {'quality': 0.8});
    } on PlatformException catch (e) {
      throw Exception('Failed to open camera: ${e.message}');
    }
  }
}

// Android: MainActivity.kt
class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.example.app/native"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getDeviceId" -> {
                    val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                    result.success(deviceId)
                }
                "openCamera" -> {
                    val quality = call.argument<Double>("quality") ?: 1.0
                    // Launch camera with quality
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}

// iOS: AppDelegate.swift
@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let controller = window?.rootViewController as! FlutterViewController
        let channel = FlutterMethodChannel(name: "com.example.app/native",
                                          binaryMessenger: controller.binaryMessenger)

        channel.setMethodCallHandler { (call: FlutterMethodCall, result: @escaping FlutterResult) in
            switch call.method {
            case "getDeviceId":
                result(UIDevice.current.identifierForVendor?.uuidString)
            case "openCamera":
                guard let args = call.arguments as? [String: Any],
                      let quality = args["quality"] as? Double else {
                    result(FlutterError(code: "INVALID_ARGS", message: nil, details: nil))
                    return
                }
                // Launch camera with quality
                result(nil)
            default:
                result(FlutterMethodNotImplemented)
            }
        }

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}
```

## Responsive Layouts

Build responsive UIs with LayoutBuilder and MediaQuery. Never hardcode dimensions.

BAD: Hardcoded dimensions
```dart
Container(
  width: 300,
  height: 500,
  child: Column(
    children: [
      Container(height: 200, child: Image.asset('banner.png')),
      Text('Title', style: TextStyle(fontSize: 24)),
    ],
  ),
)
```

GOOD: Responsive with breakpoints
```dart
class ResponsiveLayout extends StatelessWidget {
  const ResponsiveLayout({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 1200) {
          return const DesktopLayout();
        } else if (constraints.maxWidth >= 600) {
          return const TabletLayout();
        }
        return const MobileLayout();
      },
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final isSmall = size.width < 600;

    return Card(
      child: Padding(
        padding: EdgeInsets.all(isSmall ? 12 : 16),
        child: isSmall
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _buildContent(context),
              )
            : Row(
                children: _buildContent(context),
              ),
      ),
    );
  }

  List<Widget> _buildContent(BuildContext context) {
    return [
      AspectRatio(
        aspectRatio: 16 / 9,
        child: Image.network(product.imageUrl, fit: BoxFit.cover),
      ),
      const SizedBox(width: 16, height: 16),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(product.name, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text('\$${product.price.toStringAsFixed(2)}'),
          ],
        ),
      ),
    ];
  }
}
```

## Theming

Define comprehensive themes with ColorScheme and TextTheme.

```dart
// lib/theme/app_theme.dart
class AppTheme {
  static ThemeData lightTheme() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFD4943A),
      brightness: Brightness.light,
    );

    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      appBarTheme: AppBarTheme(
        centerTitle: true,
        elevation: 0,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(88, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
      ),
    );
  }

  static ThemeData darkTheme() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFD4943A),
      brightness: Brightness.dark,
      surface: const Color(0xFF0C0B0E),
    );

    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      appBarTheme: AppBarTheme(
        centerTitle: true,
        elevation: 0,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
      ),
      cardTheme: CardTheme(
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(88, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
      ),
    );
  }
}

// Usage
MaterialApp(
  theme: AppTheme.lightTheme(),
  darkTheme: AppTheme.darkTheme(),
  themeMode: ThemeMode.system,
  home: const HomeScreen(),
)
```

## Performance Optimization

Use const constructors, RepaintBoundary, and profile with DevTools.

```dart
// Always use const for widgets that don't change
const SizedBox(height: 16)
const Icon(Icons.star)
const Padding(padding: EdgeInsets.all(8), child: Text('Static'))

// Wrap expensive widgets with RepaintBoundary
class HeavyWidget extends StatelessWidget {
  const HeavyWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: ComplexPainter(),
        child: const SizedBox.expand(),
      ),
    );
  }
}

// Use ListView.builder, never ListView with large lists
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ItemTile(item: items[index]),
)

// Avoid rebuilds with proper keys
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    final item = items[index];
    return ItemTile(key: ValueKey(item.id), item: item);
  },
)
```

## HTTP with Dio

Use Dio for HTTP with interceptors and error handling.

```dart
// lib/services/api_client.dart
@riverpod
Dio dio(DioRef ref) {
  final dio = Dio(BaseOptions(
    baseUrl: 'https://api.example.com',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) {
      final token = ref.read(authStateProvider).valueOrNull?.token;
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      return handler.next(options);
    },
    onError: (error, handler) {
      if (error.response?.statusCode == 401) {
        ref.read(authStateProvider.notifier).logout();
      }
      return handler.next(error);
    },
  ));

  return dio;
}
```

## Local Storage

Use shared_preferences for settings, Hive for structured data.

```dart
// lib/services/storage_service.dart
@riverpod
SharedPreferences sharedPreferences(SharedPreferencesRef ref) {
  throw UnimplementedError();
}

// lib/main.dart override
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final sharedPrefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(sharedPrefs),
      ],
      child: const MyApp(),
    ),
  );
}

// Hive for complex data
@riverpod
class CachedProductsNotifier extends _$CachedProductsNotifier {
  late Box<Product> _box;

  @override
  Future<List<Product>> build() async {
    _box = await Hive.openBox<Product>('products');
    return _box.values.toList();
  }

  Future<void> cacheProducts(List<Product> products) async {
    await _box.clear();
    await _box.addAll(products);
    state = AsyncValue.data(products);
  }
}
```

## Testing

Write widget tests and golden tests for UI validation.

```dart
// test/widget/product_tile_test.dart
void main() {
  group('ProductTile', () {
    testWidgets('displays product information', (tester) async {
      const product = Product(
        id: '1',
        name: 'Test Product',
        price: 19.99,
        imageUrl: 'https://example.com/image.png',
      );

      await tester.pumpWidget(
        const MaterialApp(home: ProductTile(product: product)),
      );

      expect(find.text('Test Product'), findsOneWidget);
      expect(find.text('\$19.99'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      bool tapped = false;
      const product = Product(id: '1', name: 'Test', price: 10);

      await tester.pumpWidget(
        MaterialApp(
          home: ProductTile(
            product: product,
            onTap: () => tapped = true,
          ),
        ),
      );

      await tester.tap(find.byType(ProductTile));
      expect(tapped, isTrue);
    });
  });

  testWidgets('golden test for product tile', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme(),
        home: const ProductTile(
          product: Product(id: '1', name: 'Golden Test', price: 29.99),
        ),
      ),
    );

    await expectLater(
      find.byType(ProductTile),
      matchesGoldenFile('goldens/product_tile.png'),
    );
  });
}
```

## Proper Disposal

Always dispose controllers, streams, and subscriptions.

```dart
class VideoPlayerScreen extends ConsumerStatefulWidget {
  const VideoPlayerScreen({super.key});

  @override
  ConsumerState<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends ConsumerState<VideoPlayerScreen> {
  late VideoPlayerController _controller;
  StreamSubscription? _subscription;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.network('https://example.com/video.mp4')
      ..initialize().then((_) => setState(() {}));

    _subscription = ref.read(eventBusProvider).stream.listen((event) {
      if (event is PauseVideoEvent) {
        _controller.pause();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _controller.value.isInitialized
        ? AspectRatio(
            aspectRatio: _controller.value.aspectRatio,
            child: VideoPlayer(_controller),
          )
        : const CircularProgressIndicator();
  }
}
```

Run `flutter analyze` before every commit. Profile with DevTools to catch performance issues early.
