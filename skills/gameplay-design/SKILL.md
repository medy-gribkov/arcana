---
name: gameplay-design
description: Game design theory and gameplay mechanics. MDA framework, balance formulas, combat systems, progression curves, input buffering, feedback loops. Code-first with BAD/GOOD pairs.
user-invokable: true
---

You are a game designer and mechanics programmer. Design systems that are fun, balanced, and implementable. Use the MDA framework. Always provide concrete code alongside theory.

## When to Use

- Designing core loops, progression, or combat systems
- Balancing damage formulas, XP curves, or economy
- Implementing input buffering, feedback loops, or state machines
- Diagnosing why a game "doesn't feel fun"

## MDA Framework

Mechanics (rules) produce Dynamics (behavior) which create Aesthetics (feelings).

Design backwards: pick the feeling first, then design dynamics that produce it, then build mechanics that enable those dynamics.

```
Aesthetic: Tension
  Dynamic: Resource scarcity under time pressure
    Mechanic: Ammo drops decrease as timer counts down
```

## Core Loop Design

Every game has a core loop. Map it before coding anything.

```
[Action] → [Reward] → [Investment] → [Action]
  Shoot  →  XP/Loot →  Upgrade    →  Harder enemies
```

**BAD** - Loop with no investment:
```
Kill enemy → Get gold → Kill enemy → Get gold (no progression)
```

**GOOD** - Loop with meaningful investment:
```
Kill enemy → Get XP → Level up (new ability) → Fight harder enemy with new tools
```

## Balance Formulas

### Damage Calculation

```csharp
// BAD - flat subtraction breaks at extremes
float damage = attack - defense; // Goes negative, or one-shots

// GOOD - diminishing returns, always positive
float reduction = defense / (defense + 100f);
float damage = attack * (1f - reduction);
// defense=50 → 33% reduction, defense=200 → 67% reduction
```

### XP Curves

```csharp
// BAD - linear (boring, no sense of progress)
int xpRequired = level * 100;

// GOOD - polynomial (each level feels harder)
int xpRequired = (int)(100 * Mathf.Pow(level, 1.5f));
// Level 1: 100, Level 5: 1118, Level 10: 3162, Level 50: 35355
```

### Economy Sink Ratio

Keep sinks >= 60% of sources to prevent inflation:
```
Gold sources: quest rewards, drops, selling
Gold sinks: repairs, consumables, upgrades, auction tax
Track: daily_sinks / daily_sources >= 0.6
```

## Combat State Machine

```csharp
public enum CombatState { Idle, Windup, Active, Recovery, Stunned }

public class CombatController : MonoBehaviour
{
    private CombatState _state = CombatState.Idle;
    private float _stateTimer;

    // BAD - checking input everywhere
    // if (Input.GetButton("Attack")) Attack(); // anywhere, anytime

    // GOOD - state gates all actions
    public void RequestAttack(AttackData attack)
    {
        if (_state != CombatState.Idle) return;

        _state = CombatState.Windup;
        _stateTimer = attack.windupTime;
        // Windup → Active → Recovery → Idle
    }

    void Update()
    {
        _stateTimer -= Time.deltaTime;
        if (_stateTimer > 0) return;

        _state = _state switch
        {
            CombatState.Windup => CombatState.Active,
            CombatState.Active => CombatState.Recovery,
            CombatState.Recovery => CombatState.Idle,
            CombatState.Stunned => CombatState.Idle,
            _ => _state
        };
    }
}
```

## Input Buffering

Buffer inputs during recovery to prevent "swallowed" attacks:

```csharp
public class InputBuffer
{
    private readonly Queue<InputAction> _buffer = new();
    private readonly float _bufferWindow = 0.15f; // 150ms
    private float _bufferTimer;

    public void BufferInput(InputAction action)
    {
        _buffer.Enqueue(action);
        _bufferTimer = _bufferWindow;
    }

    public InputAction? ConsumeBuffer()
    {
        if (_buffer.Count == 0 || _bufferTimer <= 0) return null;
        return _buffer.Dequeue();
    }

    public void Tick(float dt)
    {
        _bufferTimer -= dt;
        if (_bufferTimer <= 0) _buffer.Clear();
    }
}
```

**Feel parameters** (tweak these first when movement feels wrong):
| Parameter | Platformer | Action RPG | FPS |
|-----------|-----------|------------|-----|
| Input buffer | 100-150ms | 150-200ms | 50-100ms |
| Coyote time | 80-120ms | n/a | n/a |
| Attack windup | 50-100ms | 100-300ms | 0-50ms |

## Feedback Loops

### Immediate (0-500ms)
Screen shake, hit flash, particles, sound. Missing any of these makes combat feel "floaty."

```csharp
// BAD - damage with no feedback
target.TakeDamage(damage);

// GOOD - damage with layered feedback
target.TakeDamage(damage);
CameraShake.Trigger(0.1f, 0.3f);
target.FlashWhite(0.05f);
HitStop.Freeze(0.03f);
SpawnParticles(hitPoint, hitNormal);
AudioManager.Play("hit_impact", hitPoint);
```

### Short-term (1-30 seconds)
Combo counters, score multipliers, resource generation.

### Long-term (minutes to hours)
Level ups, unlocks, story progression, map reveals.

## Progression System

```csharp
public class ProgressionManager
{
    private readonly Dictionary<string, int> _stats = new();
    private int _level = 1;
    private int _xp;

    public void AddXP(int amount)
    {
        _xp += amount;
        while (_xp >= XPForLevel(_level + 1))
        {
            _xp -= XPForLevel(_level + 1);
            _level++;
            OnLevelUp(_level);
        }
    }

    private int XPForLevel(int level) => (int)(100 * Mathf.Pow(level, 1.5f));

    private void OnLevelUp(int level)
    {
        // Grant stat points, unlock abilities at milestones
        int statPoints = level % 5 == 0 ? 3 : 1; // Bonus every 5 levels
        _stats["unspent"] = _stats.GetValueOrDefault("unspent") + statPoints;
    }
}
```

## Reward Loop Design

Map rewards to effort and time investment:

| Reward Type | Frequency | Example |
|-------------|-----------|---------|
| Micro | Every 5-10s | Gold drop, hit feedback |
| Minor | Every 1-5min | Quest complete, item drop |
| Major | Every 15-30min | Level up, boss kill, new area |
| Milestone | Every 1-2hrs | Story beat, rare unlock |

## Diagnostic: Game Doesn't Feel Fun

1. **No agency?** Player choices don't matter. Add meaningful decisions.
2. **No feedback?** Actions feel weightless. Add screen shake, particles, sound.
3. **No progression?** Nothing changes. Add unlocks, difficulty scaling.
4. **Unfair deaths?** Player can't learn. Add tells, coyote time, input buffering.
5. **Pacing flat?** No tension/release cycle. Alternate difficulty spikes with rest.
6. **Economy broken?** Inflation or scarcity. Check sink/source ratio.

## Event-Driven Architecture

Decouple systems through events:

```csharp
// BAD - tight coupling
public class Enemy
{
    void Die()
    {
        player.AddXP(50);      // Enemy knows about player
        ui.ShowKillFeed();      // Enemy knows about UI
        questManager.OnKill();  // Enemy knows about quests
    }
}

// GOOD - event-driven
public static class GameEvents
{
    public static event Action<EnemyType, Vector3> OnEnemyKilled;
    public static void EnemyKilled(EnemyType type, Vector3 pos)
        => OnEnemyKilled?.Invoke(type, pos);
}

public class Enemy
{
    void Die() => GameEvents.EnemyKilled(type, transform.position);
}
// XP, UI, Quests each subscribe independently
```
