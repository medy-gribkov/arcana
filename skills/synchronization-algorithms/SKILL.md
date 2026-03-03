---
name: synchronization-algorithms
description: Network synchronization for multiplayer games with client prediction, server reconciliation, rollback netcode implementation, and state consistency techniques.
---

## Client Prediction & Server Reconciliation

**Problem:** Network latency makes games feel sluggish.

**Solution:** Predict locally, reconcile with server when authoritative state arrives.

```csharp
// BAD: Wait for server confirmation
void Update()
{
    if (Input.GetKey(KeyCode.W))
    {
        SendInputToServer(InputType.Forward);
        // Wait for server response before moving
        // Result: 100ms delay on every input
    }
}

// GOOD: Predict immediately, reconcile later
public class PredictedPlayer : MonoBehaviour
{
    private PredictionBuffer _buffer = new PredictionBuffer(128);
    private uint _currentTick = 0;

    void Update()
    {
        // 1. Capture input
        InputPayload input = new InputPayload
        {
            Forward = Input.GetKey(KeyCode.W),
            Jump = Input.GetKeyDown(KeyCode.Space),
            MouseDelta = new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y"))
        };

        // 2. Predict result locally (instant feedback)
        PlayerState predictedState = SimulateInput(_currentState, input);
        ApplyState(predictedState);

        // 3. Store for reconciliation
        _buffer.Store(_currentTick, input, predictedState);

        // 4. Send to server
        NetworkClient.Send(new InputMessage
        {
            Tick = _currentTick,
            Input = input
        });

        _currentTick++;
    }

    private PlayerState SimulateInput(PlayerState state, InputPayload input)
    {
        // Deterministic simulation (must match server)
        Vector3 velocity = state.Velocity;
        Vector3 position = state.Position;

        if (input.Forward)
            velocity += transform.forward * moveSpeed * Time.deltaTime;

        velocity.y -= gravity * Time.deltaTime;
        position += velocity * Time.deltaTime;

        return new PlayerState { Position = position, Velocity = velocity };
    }

    // Called when server state arrives
    void OnServerState(ServerStateMessage msg)
    {
        _buffer.Reconcile(msg.Tick, msg.State);
    }
}
```

## Prediction Buffer & Reconciliation

```csharp
public struct PredictionEntry
{
    public uint Tick;
    public InputPayload Input;
    public PlayerState PredictedState;
}

public class PredictionBuffer
{
    private readonly PredictionEntry[] _buffer;
    private readonly int _size;

    public PredictionBuffer(int size)
    {
        _size = size;
        _buffer = new PredictionEntry[size];
    }

    public void Store(uint tick, InputPayload input, PlayerState predictedState)
    {
        int index = (int)(tick % _size);
        _buffer[index] = new PredictionEntry
        {
            Tick = tick,
            Input = input,
            PredictedState = predictedState
        };
    }

    public void Reconcile(uint serverTick, PlayerState serverState)
    {
        int index = (int)(serverTick % _size);
        PredictionEntry entry = _buffer[index];

        if (entry.Tick != serverTick)
        {
            Debug.LogWarning($"Stale data: expected {serverTick}, got {entry.Tick}");
            return;
        }

        // Calculate prediction error
        float positionError = Vector3.Distance(entry.PredictedState.Position, serverState.Position);

        if (positionError < 0.01f)
        {
            // Prediction was accurate, no correction needed
            return;
        }

        Debug.Log($"Misprediction detected: {positionError:F3}m error");

        // Reconciliation: re-simulate from server state
        PlayerState correctedState = serverState;

        // Re-apply all inputs since server tick
        for (uint t = serverTick + 1; t <= CurrentTick; t++)
        {
            int idx = (int)(t % _size);
            if (_buffer[idx].Tick == t)
            {
                correctedState = SimulateInput(correctedState, _buffer[idx].Input);
            }
        }

        // Apply correction with smoothing to avoid visual pop
        StartCoroutine(SmoothCorrection(correctedState, 0.1f));
    }

    private IEnumerator SmoothCorrection(PlayerState targetState, float duration)
    {
        Vector3 startPos = transform.position;
        float elapsed = 0f;

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            transform.position = Vector3.Lerp(startPos, targetState.Position, t);
            yield return null;
        }

        transform.position = targetState.Position;
        _currentState = targetState;
    }
}
```

## Rollback Netcode (Fighting Games)

```csharp
public class RollbackManager
{
    private const int MAX_ROLLBACK_FRAMES = 8;  // ~133ms at 60fps
    private const int BUFFER_SIZE = 128;

    private GameState[] _stateHistory = new GameState[BUFFER_SIZE];
    private InputPayload[] _player1Inputs = new InputPayload[BUFFER_SIZE];
    private InputPayload[] _player2Inputs = new InputPayload[BUFFER_SIZE];

    private uint _currentFrame = 0;
    private uint _confirmedFrame = 0;  // Last frame with confirmed inputs

    public void AdvanceFrame(InputPayload localInput, InputPayload? remoteInput)
    {
        // Store local input
        int index = (int)(_currentFrame % BUFFER_SIZE);
        _player1Inputs[index] = localInput;

        if (remoteInput.HasValue)
        {
            // Got remote input for this frame
            _player2Inputs[index] = remoteInput.Value;

            // Check if we need to rollback
            if (ShouldRollback(index))
            {
                PerformRollback();
            }

            _confirmedFrame = _currentFrame;
        }
        else
        {
            // No remote input yet, predict (repeat last input)
            int lastIndex = (int)((_currentFrame - 1) % BUFFER_SIZE);
            _player2Inputs[index] = _player2Inputs[lastIndex];
        }

        // Simulate frame
        GameState newState = SimulateFrame(
            _stateHistory[(int)((_currentFrame - 1) % BUFFER_SIZE)],
            _player1Inputs[index],
            _player2Inputs[index]
        );

        _stateHistory[index] = newState;
        _currentFrame++;
    }

    private bool ShouldRollback(int currentIndex)
    {
        // Check if predicted input differs from confirmed
        uint framesToCheck = _currentFrame - _confirmedFrame;
        if (framesToCheck > MAX_ROLLBACK_FRAMES)
            return false;  // Too far back, accept desync

        // Compare predicted vs actual for past frames
        for (uint i = _confirmedFrame; i < _currentFrame; i++)
        {
            int idx = (int)(i % BUFFER_SIZE);
            if (!InputsEqual(_player2Inputs[idx], GetConfirmedInput(i)))
                return true;
        }

        return false;
    }

    private void PerformRollback()
    {
        Debug.Log($"Rolling back from frame {_currentFrame} to {_confirmedFrame}");

        // Load confirmed state
        int confirmedIndex = (int)(_confirmedFrame % BUFFER_SIZE);
        GameState rolledBackState = _stateHistory[confirmedIndex];

        // Re-simulate frames with correct inputs
        for (uint frame = _confirmedFrame + 1; frame < _currentFrame; frame++)
        {
            int idx = (int)(frame % BUFFER_SIZE);
            rolledBackState = SimulateFrame(
                rolledBackState,
                _player1Inputs[idx],
                GetConfirmedInput(frame)  // Use actual input, not prediction
            );
            _stateHistory[idx] = rolledBackState;
        }

        // Apply corrected state
        ApplyGameState(rolledBackState);
    }

    private GameState SimulateFrame(GameState state, InputPayload p1Input, InputPayload p2Input)
    {
        // Deterministic simulation (fixed-point math, no floats!)
        GameState newState = state.Clone();

        // Player 1 logic
        if (p1Input.Attack && !state.Player1.IsAttacking)
        {
            newState.Player1.IsAttacking = true;
            newState.Player1.AttackFrame = 0;
        }

        // Player 2 logic
        if (p2Input.Attack && !state.Player2.IsAttacking)
        {
            newState.Player2.IsAttacking = true;
            newState.Player2.AttackFrame = 0;
        }

        // Collision detection, damage, etc.
        DetectHits(newState);

        return newState;
    }
}
```

## Interpolation for Remote Players

```csharp
public class InterpolatedRemotePlayer : MonoBehaviour
{
    private const float INTERPOLATION_DELAY = 0.1f;  // 100ms buffer

    private struct StateSnapshot
    {
        public float Time;
        public Vector3 Position;
        public Quaternion Rotation;
    }

    private Queue<StateSnapshot> _stateBuffer = new Queue<StateSnapshot>();
    private float _renderTime = 0f;

    void Start()
    {
        _renderTime = Time.time - INTERPOLATION_DELAY;
    }

    // Called when network state update arrives
    public void OnStateUpdate(Vector3 position, Quaternion rotation)
    {
        _stateBuffer.Enqueue(new StateSnapshot
        {
            Time = Time.time,
            Position = position,
            Rotation = rotation
        });

        // Keep buffer size reasonable
        while (_stateBuffer.Count > 20)
            _stateBuffer.Dequeue();
    }

    void Update()
    {
        _renderTime += Time.deltaTime;

        // Remove old states
        while (_stateBuffer.Count > 2 && _stateBuffer.Peek().Time < _renderTime)
        {
            _stateBuffer.Dequeue();
        }

        if (_stateBuffer.Count < 2)
            return;  // Need at least 2 states to interpolate

        // Get two states to interpolate between
        StateSnapshot[] states = _stateBuffer.ToArray();
        StateSnapshot from = states[0];
        StateSnapshot to = states[1];

        // Interpolate
        float duration = to.Time - from.Time;
        float t = (duration == 0f) ? 0f : (_renderTime - from.Time) / duration;
        t = Mathf.Clamp01(t);

        transform.position = Vector3.Lerp(from.Position, to.Position, t);
        transform.rotation = Quaternion.Slerp(from.Rotation, to.Rotation, t);
    }
}
```

## Lockstep (RTS Games)

```csharp
public class LockstepManager
{
    private const int TURN_DURATION_MS = 200;  // 5 turns/second

    private uint _currentTurn = 0;
    private Dictionary<int, InputPayload>[] _inputBuffer = new Dictionary<int, InputPayload>[1024];
    private int[] _connectedPlayers = new int[] { 1, 2, 3, 4 };

    public void Update()
    {
        // Wait until we have inputs from ALL players for current turn
        if (!HasAllInputs(_currentTurn))
        {
            // Still waiting for slow player
            return;
        }

        // Execute turn deterministically
        ExecuteTurn(_currentTurn);
        _currentTurn++;
    }

    private bool HasAllInputs(uint turn)
    {
        int index = (int)(turn % 1024);
        if (_inputBuffer[index] == null)
            return false;

        foreach (int playerId in _connectedPlayers)
        {
            if (!_inputBuffer[index].ContainsKey(playerId))
                return false;
        }

        return true;
    }

    private void ExecuteTurn(uint turn)
    {
        int index = (int)(turn % 1024);

        // Execute inputs in deterministic order (sorted by player ID)
        foreach (int playerId in _connectedPlayers.OrderBy(x => x))
        {
            InputPayload input = _inputBuffer[index][playerId];
            ProcessPlayerInput(playerId, input);
        }

        // Simulate game logic (must be deterministic!)
        SimulateGameLogic();
    }

    // Called when input received from network
    public void OnPlayerInput(int playerId, uint turn, InputPayload input)
    {
        int index = (int)(turn % 1024);
        if (_inputBuffer[index] == null)
            _inputBuffer[index] = new Dictionary<int, InputPayload>();

        _inputBuffer[index][playerId] = input;
    }
}
```

## Deterministic Simulation (Required for Lockstep/Rollback)

```csharp
// BAD: non-deterministic (floating point, order-dependent)
void MoveUnits()
{
    foreach (var unit in units)  // Order undefined!
    {
        unit.position += unit.velocity * Time.deltaTime;  // Float precision varies!
    }
}

// GOOD: deterministic (fixed-point, sorted order)
void MoveUnits()
{
    // Sort by ID for consistent order
    foreach (var unit in units.OrderBy(u => u.ID))
    {
        // Fixed-point math (integers, no floats)
        unit.positionFixed += unit.velocityFixed * FIXED_DELTA_TIME;
    }
}

// Fixed-point vector struct
public struct FixedVector3
{
    public long X, Y, Z;  // 1/1000 precision (e.g., 1000 = 1.0)

    public static FixedVector3 operator +(FixedVector3 a, FixedVector3 b)
    {
        return new FixedVector3
        {
            X = a.X + b.X,
            Y = a.Y + b.Y,
            Z = a.Z + b.Z
        };
    }

    public static FixedVector3 operator *(FixedVector3 v, long scalar)
    {
        return new FixedVector3
        {
            X = (v.X * scalar) / 1000,
            Y = (v.Y * scalar) / 1000,
            Z = (v.Z * scalar) / 1000
        };
    }
}
```
