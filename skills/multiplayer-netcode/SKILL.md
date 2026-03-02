---
name: multiplayer-netcode
description: Multiplayer networking, netcode, and synchronization. Client prediction, server reconciliation, rollback netcode, lag compensation, anti-cheat, bandwidth optimization. Production C# and architecture patterns.
user-invokable: true
---

You are a multiplayer systems engineer. Build authoritative server architectures with client-side prediction. Optimize for latency, bandwidth, and cheat resistance. Always provide production code.

## When to Use

- Implementing client prediction and server reconciliation
- Building rollback netcode for fighting or action games
- Designing server architecture for online games
- Optimizing bandwidth or fixing rubber-banding
- Adding anti-cheat to multiplayer systems

## Architecture: Client-Server Authoritative

```
Client A                Server               Client B
  │                       │                     │
  ├─ Input ──────────────►│                     │
  ├─ Predict locally      │                     │
  │                       ├─ Validate           │
  │                       ├─ Simulate           │
  │◄── State snapshot ────┤──── State snapshot ─►│
  ├─ Reconcile            │                     ├─ Interpolate
```

**BAD** - Client authoritative (cheatable):
```csharp
// Client sends position directly
void Update()
{
    transform.position += moveDir * speed * Time.deltaTime;
    SendToServer(transform.position); // Server trusts this
}
```

**GOOD** - Server authoritative with prediction:
```csharp
// Client sends inputs, predicts locally, server validates
void Update()
{
    var input = new InputPayload
    {
        Tick = _currentTick,
        Movement = GetMovementInput(),
        Timestamp = NetworkTime.time
    };
    SendInputToServer(input);
    PredictLocally(input);  // Immediate response
    _inputHistory.Add(input);
    _currentTick++;
}
```

## Client Prediction & Reconciliation

```csharp
public class PredictionSystem
{
    private readonly CircularBuffer<PlayerState> _stateBuffer;
    private readonly CircularBuffer<InputPayload> _inputBuffer;
    private int _lastServerTick;

    public void OnServerState(PlayerState serverState)
    {
        _lastServerTick = serverState.Tick;
        PlayerState predicted = _stateBuffer.Get(serverState.Tick);

        // Compare server state with our prediction
        float error = Vector3.Distance(predicted.Position, serverState.Position);

        if (error > 0.01f)
        {
            // Prediction was wrong, reconcile
            Reconcile(serverState);
        }
    }

    private void Reconcile(PlayerState serverState)
    {
        // Reset to server state
        PlayerState current = serverState;

        // Re-simulate all inputs since server tick
        for (int tick = serverState.Tick + 1; tick <= _currentTick; tick++)
        {
            InputPayload input = _inputBuffer.Get(tick);
            current = Simulate(current, input);
            _stateBuffer.Set(tick, current);
        }

        ApplyState(current);
    }

    private PlayerState Simulate(PlayerState state, InputPayload input)
    {
        return new PlayerState
        {
            Tick = input.Tick,
            Position = state.Position + input.Movement * _moveSpeed * _tickRate,
            Velocity = input.Movement * _moveSpeed
        };
    }
}
```

## Rollback Netcode (Fighting Games)

For frame-precise games where delay is unacceptable:

```csharp
public class RollbackManager
{
    private readonly GameState[] _stateHistory = new GameState[MAX_ROLLBACK];
    private int _confirmedFrame;
    private int _currentFrame;

    public void OnRemoteInput(int frame, InputData input)
    {
        if (frame < _currentFrame)
        {
            // Input arrived late, need rollback
            int rollbackFrames = _currentFrame - frame;
            if (rollbackFrames > MAX_ROLLBACK) return; // Too far, skip

            // 1. Restore state at the frame
            RestoreState(frame);

            // 2. Apply the correct input
            _remoteInputs[frame] = input;

            // 3. Re-simulate forward to current frame
            for (int f = frame; f < _currentFrame; f++)
            {
                SimulateFrame(f, _localInputs[f], _remoteInputs[f]);
                SaveState(f + 1);
            }
        }
        else
        {
            _remoteInputs[frame] = input;
        }
    }

    private void SaveState(int frame)
    {
        _stateHistory[frame % MAX_ROLLBACK] = CaptureFullGameState();
    }

    private void RestoreState(int frame)
    {
        ApplyFullGameState(_stateHistory[frame % MAX_ROLLBACK]);
    }
}
```

**Rollback budget:** Max 7 frames at 60fps (117ms). Beyond that, add input delay.

## Lag Compensation (Server-Side Rewind)

For hit detection in shooters:

```csharp
public class LagCompensation
{
    private readonly Dictionary<int, List<HitboxSnapshot>> _history = new();

    public void SaveSnapshot(int tick, List<Player> players)
    {
        var snapshot = players.Select(p => new HitboxSnapshot
        {
            PlayerId = p.Id,
            Position = p.Position,
            Hitboxes = p.GetHitboxes()
        }).ToList();

        _history[tick] = snapshot;

        // Keep 1 second of history
        if (_history.ContainsKey(tick - _tickRate))
            _history.Remove(tick - _tickRate);
    }

    public HitResult ProcessShot(int shooterTick, Ray ray, int shooterId)
    {
        if (!_history.TryGetValue(shooterTick, out var snapshot))
            return HitResult.Miss;

        // Rewind to shooter's perspective
        foreach (var hitbox in snapshot.Where(h => h.PlayerId != shooterId))
        {
            if (RayIntersectsHitbox(ray, hitbox))
            {
                return new HitResult
                {
                    Hit = true,
                    PlayerId = hitbox.PlayerId,
                    HitZone = GetHitZone(ray, hitbox)
                };
            }
        }
        return HitResult.Miss;
    }
}
```

## Interpolation (Remote Players)

Render remote players between snapshots for smooth movement:

```csharp
public class InterpolationSystem
{
    private readonly Queue<StateSnapshot> _snapshots = new();
    private const float INTERPOLATION_DELAY = 0.1f; // 100ms behind

    public Vector3 GetInterpolatedPosition(float currentTime)
    {
        float renderTime = currentTime - INTERPOLATION_DELAY;

        // Find two snapshots to interpolate between
        StateSnapshot before = default, after = default;
        foreach (var snap in _snapshots)
        {
            if (snap.Timestamp <= renderTime) before = snap;
            if (snap.Timestamp >= renderTime) { after = snap; break; }
        }

        if (before.Timestamp == 0 || after.Timestamp == 0)
            return _lastKnownPosition;

        float t = (renderTime - before.Timestamp) /
                  (after.Timestamp - before.Timestamp);
        return Vector3.Lerp(before.Position, after.Position, t);
    }
}
```

## Bandwidth Optimization

| Technique | Savings | Complexity |
|-----------|---------|------------|
| Delta compression | 40-60% | Medium |
| Quantization (16-bit pos) | 30-50% | Low |
| Interest management | 50-80% | High |
| Bitpacking | 20-40% | Low |

**BAD** - Sending full state every frame:
```csharp
// 24 bytes per entity per tick = 2.4KB/s at 100 entities, 100 tick
Send(new { x = pos.x, y = pos.y, z = pos.z, /* 20 more fields */ });
```

**GOOD** - Delta + bitpacking:
```csharp
void WriteDelta(BitWriter writer, PlayerState prev, PlayerState curr)
{
    byte changed = 0;
    if (prev.Position != curr.Position) changed |= 0x01;
    if (prev.Rotation != curr.Rotation) changed |= 0x02;
    if (prev.Health != curr.Health) changed |= 0x04;

    writer.WriteByte(changed);
    if ((changed & 0x01) != 0) writer.WriteVector3Quantized(curr.Position, 16);
    if ((changed & 0x02) != 0) writer.WriteQuaternionCompressed(curr.Rotation);
    if ((changed & 0x04) != 0) writer.WriteByte((byte)curr.Health);
}
```

## Anti-Cheat (4-Layer Approach)

1. **Server authority:** Never trust client state. Validate all inputs.
2. **Sanity checks:** Flag impossible values (speed > max, teleportation).
3. **Statistical detection:** Track accuracy, reaction time, movement patterns.
4. **Replay validation:** Log inputs for post-match review.

```csharp
public class ServerValidator
{
    public bool ValidateInput(InputPayload input, PlayerState lastState)
    {
        // Speed check
        float maxDistance = _maxSpeed * _tickDuration * 1.1f; // 10% tolerance
        float distance = Vector3.Distance(
            lastState.Position,
            Simulate(lastState, input).Position
        );
        if (distance > maxDistance) return false;

        // Fire rate check
        if (input.Fire && _lastFireTick + _minFireInterval > input.Tick)
            return false;

        return true;
    }
}
```

## Server Architecture

```
                    ┌──────────────┐
                    │  Matchmaker  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Game Srv │ │ Game Srv │ │ Game Srv │
        │ (US-E)   │ │ (EU-W)   │ │ (APAC)   │
        └──────────┘ └──────────┘ └──────────┘
```

**Tick rates by genre:**
| Genre | Server Tick | Client Send | Interpolation |
|-------|------------|-------------|---------------|
| FPS | 64-128 Hz | 64-128 Hz | 100ms |
| Fighting | 60 Hz | 60 Hz | 0ms (rollback) |
| MOBA | 30 Hz | 30 Hz | 100ms |
| MMO | 10-20 Hz | 10-20 Hz | 200ms |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Rubber-banding | Prediction error too high | Increase reconciliation smoothing |
| Teleporting | Missing packets | Add interpolation buffer |
| Hit not registering | No lag compensation | Implement server rewind |
| High bandwidth | Full state sync | Add delta compression |
| Desync | Float non-determinism | Use fixed-point math |
