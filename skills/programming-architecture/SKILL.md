---
name: programming-architecture
description: Game programming architecture patterns with ECS, data-oriented design, state machines, object pools, and concrete implementations for scalable game systems.
---

## Entity Component System (ECS)

**Traditional OOP (BAD):**

```csharp
// Everything coupled, hard to optimize
public class Enemy : MonoBehaviour
{
    public float health;
    public float speed;
    public Rigidbody rb;

    void Update()
    {
        // Movement
        rb.velocity = transform.forward * speed;

        // AI
        if (PlayerInRange()) Attack();

        // Health
        if (health <= 0) Die();
    }
}
// Problem: 1000 enemies = 1000 Update() calls, cache misses
```

**ECS (GOOD):**

```csharp
// Components are pure data
public struct Position : IComponentData
{
    public float3 Value;
}

public struct Velocity : IComponentData
{
    public float3 Value;
}

public struct Health : IComponentData
{
    public float Current;
    public float Max;
}

// Systems process components in bulk (cache-friendly)
public partial class MovementSystem : SystemBase
{
    protected override void OnUpdate()
    {
        float deltaTime = Time.DeltaTime;

        // Processes ALL entities with Position + Velocity
        // in tight loop, vectorized by Burst compiler
        Entities.ForEach((ref Position pos, in Velocity vel) =>
        {
            pos.Value += vel.Value * deltaTime;
        }).ScheduleParallel();
    }
}

public partial class HealthSystem : SystemBase
{
    protected override void OnUpdate()
    {
        var ecb = new EntityCommandBuffer(Allocator.TempJob);

        Entities.ForEach((Entity entity, in Health health) =>
        {
            if (health.Current <= 0)
            {
                ecb.DestroyEntity(entity);
            }
        }).Schedule();

        ecb.Playback(EntityManager);
        ecb.Dispose();
    }
}
```

**Performance comparison:**

```csharp
// OOP: 1000 enemies
// Update() calls: 1000/frame
// Cache misses: high (scattered objects)
// Parallelization: hard

// ECS: 1000 enemies
// System calls: 1/frame per system
// Cache misses: low (contiguous arrays)
// Parallelization: automatic with Burst
// Result: 10-100x faster for large entity counts
```

## Data-Oriented Design

**BAD (Object-Oriented):**

```csharp
public class Particle
{
    public Vector3 position;
    public Vector3 velocity;
    public Color color;
    public float lifetime;
    public ParticleType type;  // Rarely accessed
    public string debugName;   // Never in release
}

List<Particle> particles = new();  // Scattered in memory

void UpdateParticles()
{
    foreach (var p in particles)  // Cache miss on every access
    {
        p.position += p.velocity * Time.deltaTime;
        p.lifetime -= Time.deltaTime;
    }
}
```

**GOOD (Data-Oriented):**

```csharp
public class ParticleSystem
{
    // Structure of Arrays (SoA) - cache friendly
    private Vector3[] positions;
    private Vector3[] velocities;
    private float[] lifetimes;
    private Color[] colors;
    private int count;

    public ParticleSystem(int capacity)
    {
        positions = new Vector3[capacity];
        velocities = new Vector3[capacity];
        lifetimes = new float[capacity];
        colors = new Color[capacity];
    }

    public void Update(float deltaTime)
    {
        // Hot data in contiguous arrays - CPU cache loves this
        for (int i = 0; i < count; i++)
        {
            positions[i] += velocities[i] * deltaTime;
            lifetimes[i] -= deltaTime;

            if (lifetimes[i] <= 0)
            {
                RemoveParticle(i--);
            }
        }
    }

    private void RemoveParticle(int index)
    {
        // Swap with last element (constant time)
        int last = --count;
        positions[index] = positions[last];
        velocities[index] = velocities[last];
        lifetimes[index] = lifetimes[last];
        colors[index] = colors[last];
    }
}
```

## State Machine (Production-Ready)

```csharp
// Abstract state base
public abstract class State<T> where T : class
{
    protected T Context { get; private set; }

    public void SetContext(T context) => Context = context;
    public virtual void Enter() { }
    public virtual void Update() { }
    public virtual void FixedUpdate() { }
    public virtual void Exit() { }
}

// State machine manager
public class StateMachine<T> where T : class
{
    private State<T> _current;
    private readonly T _context;

    public State<T> CurrentState => _current;

    public StateMachine(T context, State<T> initialState)
    {
        _context = context;
        ChangeState(initialState);
    }

    public void ChangeState(State<T> newState)
    {
        _current?.Exit();
        _current = newState;
        _current.SetContext(_context);
        _current.Enter();
    }

    public void Update() => _current?.Update();
    public void FixedUpdate() => _current?.FixedUpdate();
}

// Concrete states
public class PlayerIdleState : State<Player>
{
    public override void Enter()
    {
        Context.Animator.Play("Idle");
        Context.Velocity = Vector3.zero;
    }

    public override void Update()
    {
        if (Context.Input.magnitude > 0.1f)
            Context.StateMachine.ChangeState(new PlayerMoveState());

        if (Context.Input.Jump)
            Context.StateMachine.ChangeState(new PlayerJumpState());
    }
}

public class PlayerMoveState : State<Player>
{
    public override void Enter()
    {
        Context.Animator.Play("Run");
    }

    public override void FixedUpdate()
    {
        Vector3 move = Context.Input * Context.MoveSpeed;
        Context.Rigidbody.MovePosition(Context.transform.position + move * Time.fixedDeltaTime);
    }

    public override void Update()
    {
        if (Context.Input.magnitude < 0.1f)
            Context.StateMachine.ChangeState(new PlayerIdleState());

        if (Context.Input.Jump)
            Context.StateMachine.ChangeState(new PlayerJumpState());
    }
}

// Usage in Player class
public class Player : MonoBehaviour
{
    public StateMachine<Player> StateMachine { get; private set; }
    public Vector3 Input => new Vector3(InputX, 0, InputY);
    // ... other properties

    void Start()
    {
        StateMachine = new StateMachine<Player>(this, new PlayerIdleState());
    }

    void Update() => StateMachine.Update();
    void FixedUpdate() => StateMachine.FixedUpdate();
}
```

## Object Pool (Production-Ready)

```csharp
// Generic object pool
public class ObjectPool<T> where T : Component
{
    private readonly Queue<T> _pool = new();
    private readonly T _prefab;
    private readonly Transform _parent;
    private readonly int _maxSize;

    public ObjectPool(T prefab, int initialSize, int maxSize = 1000, Transform parent = null)
    {
        _prefab = prefab;
        _maxSize = maxSize;
        _parent = parent;

        for (int i = 0; i < initialSize; i++)
            _pool.Enqueue(CreateInstance());
    }

    public T Get(Vector3 position, Quaternion rotation)
    {
        T obj = _pool.Count > 0 ? _pool.Dequeue() : CreateInstance();

        obj.transform.position = position;
        obj.transform.rotation = rotation;
        obj.gameObject.SetActive(true);

        return obj;
    }

    public void Return(T obj)
    {
        if (_pool.Count >= _maxSize)
        {
            Object.Destroy(obj.gameObject);
            return;
        }

        obj.gameObject.SetActive(false);
        _pool.Enqueue(obj);
    }

    private T CreateInstance()
    {
        T instance = Object.Instantiate(_prefab, _parent);
        instance.gameObject.SetActive(false);
        return instance;
    }

    public void Clear()
    {
        while (_pool.Count > 0)
        {
            Object.Destroy(_pool.Dequeue().gameObject);
        }
    }
}

// Pooled bullet example
public class Bullet : MonoBehaviour
{
    public float lifetime = 3f;
    private float _spawnTime;
    private ObjectPool<Bullet> _pool;

    public void Initialize(ObjectPool<Bullet> pool)
    {
        _pool = pool;
        _spawnTime = Time.time;
    }

    void Update()
    {
        if (Time.time - _spawnTime > lifetime)
            _pool.Return(this);
    }

    void OnCollisionEnter(Collision collision)
    {
        // Hit something, return to pool
        _pool.Return(this);
    }
}

// Usage
public class Gun : MonoBehaviour
{
    [SerializeField] private Bullet bulletPrefab;
    private ObjectPool<Bullet> _bulletPool;

    void Start()
    {
        _bulletPool = new ObjectPool<Bullet>(
            bulletPrefab,
            initialSize: 50,
            maxSize: 200,
            parent: transform
        );
    }

    void Shoot()
    {
        Bullet bullet = _bulletPool.Get(firePoint.position, firePoint.rotation);
        bullet.Initialize(_bulletPool);
        bullet.GetComponent<Rigidbody>().velocity = firePoint.forward * bulletSpeed;
    }
}
```

## Observer Pattern (Event System)

```csharp
// Type-safe event system
public static class GameEvents
{
    // Score events
    public static event Action<int> OnScoreChanged;
    public static event Action<int, int> OnComboChanged;  // current, max

    // Health events
    public static event Action<float, float> OnHealthChanged;  // current, max
    public static event Action OnPlayerDied;

    // Game state events
    public static event Action OnGameStarted;
    public static event Action OnGamePaused;
    public static event Action OnGameResumed;

    // Invoke methods
    public static void ScoreChanged(int newScore) => OnScoreChanged?.Invoke(newScore);
    public static void HealthChanged(float current, float max) => OnHealthChanged?.Invoke(current, max);
    public static void PlayerDied() => OnPlayerDied?.Invoke();
}

// Subscriber example
public class UIManager : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI scoreText;
    [SerializeField] private Slider healthBar;
    [SerializeField] private GameObject gameOverPanel;

    void OnEnable()
    {
        GameEvents.OnScoreChanged += UpdateScore;
        GameEvents.OnHealthChanged += UpdateHealth;
        GameEvents.OnPlayerDied += ShowGameOver;
    }

    void OnDisable()
    {
        GameEvents.OnScoreChanged -= UpdateScore;
        GameEvents.OnHealthChanged -= UpdateHealth;
        GameEvents.OnPlayerDied -= ShowGameOver;
    }

    private void UpdateScore(int score)
    {
        scoreText.text = $"Score: {score}";
    }

    private void UpdateHealth(float current, float max)
    {
        healthBar.value = current / max;
    }

    private void ShowGameOver()
    {
        gameOverPanel.SetActive(true);
    }
}
```

## Command Pattern (Undo/Redo)

```csharp
public interface ICommand
{
    void Execute();
    void Undo();
}

public class MoveCommand : ICommand
{
    private readonly Transform _target;
    private readonly Vector3 _direction;
    private Vector3 _previousPosition;

    public MoveCommand(Transform target, Vector3 direction)
    {
        _target = target;
        _direction = direction;
    }

    public void Execute()
    {
        _previousPosition = _target.position;
        _target.position += _direction;
    }

    public void Undo()
    {
        _target.position = _previousPosition;
    }
}

public class RotateCommand : ICommand
{
    private readonly Transform _target;
    private readonly float _angle;
    private Quaternion _previousRotation;

    public RotateCommand(Transform target, float angle)
    {
        _target = target;
        _angle = angle;
    }

    public void Execute()
    {
        _previousRotation = _target.rotation;
        _target.Rotate(Vector3.up, _angle);
    }

    public void Undo()
    {
        _target.rotation = _previousRotation;
    }
}

// Command manager with undo/redo stack
public class CommandManager
{
    private readonly Stack<ICommand> _undoStack = new();
    private readonly Stack<ICommand> _redoStack = new();

    public void ExecuteCommand(ICommand command)
    {
        command.Execute();
        _undoStack.Push(command);
        _redoStack.Clear();  // Clear redo stack on new action
    }

    public void Undo()
    {
        if (_undoStack.Count == 0) return;

        ICommand command = _undoStack.Pop();
        command.Undo();
        _redoStack.Push(command);
    }

    public void Redo()
    {
        if (_redoStack.Count == 0) return;

        ICommand command = _redoStack.Pop();
        command.Execute();
        _undoStack.Push(command);
    }
}

// Usage in level editor
public class LevelEditor : MonoBehaviour
{
    private CommandManager _commandManager = new();

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.W))
            _commandManager.ExecuteCommand(new MoveCommand(selectedObject, Vector3.forward));

        if (Input.GetKeyDown(KeyCode.Z))
            _commandManager.Undo();

        if (Input.GetKeyDown(KeyCode.Y))
            _commandManager.Redo();
    }
}
```

## Service Locator

```csharp
// Service locator (use sparingly, prefer dependency injection)
public static class Services
{
    private static readonly Dictionary<Type, object> _services = new();

    public static void Register<T>(T service) where T : class
    {
        _services[typeof(T)] = service;
    }

    public static T Get<T>() where T : class
    {
        if (_services.TryGetValue(typeof(T), out object service))
            return service as T;

        throw new Exception($"Service {typeof(T)} not registered");
    }

    public static bool TryGet<T>(out T service) where T : class
    {
        if (_services.TryGetValue(typeof(T), out object obj))
        {
            service = obj as T;
            return true;
        }

        service = null;
        return false;
    }
}

// Register services at startup
public class GameBootstrapper : MonoBehaviour
{
    void Awake()
    {
        Services.Register(new AudioManager());
        Services.Register(new SaveManager());
        Services.Register(new AnalyticsManager());
    }
}

// Access from anywhere
public class Enemy : MonoBehaviour
{
    void Die()
    {
        Services.Get<AudioManager>().PlaySound("enemy_death");
        Services.Get<AnalyticsManager>().LogEvent("enemy_killed");
    }
}
```

## Architecture Layers

```
┌─────────────────────────────────────────┐
│         GAME LAYER                       │
│  ┌─────────────────────────────────┐   │
│  │ Managers                         │   │
│  │ - GameManager (state)            │   │
│  │ - UIManager (HUD)                │   │
│  │ - AudioManager (sound)           │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Systems (ECS or domain logic)    │   │
│  │ - CombatSystem                   │   │
│  │ - InventorySystem                │   │
│  │ - QuestSystem                    │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ Components (data + behavior)     │   │
│  │ - Health, Weapon, AI             │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│         ENGINE LAYER                     │
│  Physics | Rendering | Input | Network  │
└─────────────────────────────────────────┘
```
