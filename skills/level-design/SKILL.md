---
name: level-design
description: Level design fundamentals, pacing, difficulty progression, environmental storytelling, and spatial design for engaging gameplay experiences.
---

# Level Design

## Level Design Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                    LEVEL DESIGN PILLARS                     │
├─────────────────────────────────────────────────────────────┤
│  1. FLOW: Guide the player naturally through space         │
│  2. PACING: Control intensity and rest moments             │
│  3. DISCOVERY: Reward exploration and curiosity            │
│  4. CLARITY: Player always knows where to go               │
│  5. CHALLENGE: Skill tests that teach and satisfy          │
└─────────────────────────────────────────────────────────────┘
```

## Level Structure Patterns

```
LINEAR LEVEL:
┌─────────────────────────────────────────────────────────────┐
│  [Start] → [Tutorial] → [Challenge] → [Boss] → [End]       │
│                                                              │
│  PROS: Easy to pace, clear direction                        │
│  CONS: Limited replay value, less exploration              │
│  BEST FOR: Story-driven games, action games                │
└─────────────────────────────────────────────────────────────┘

HUB & SPOKE:
┌─────────────────────────────────────────────────────────────┐
│              [Level A]                                       │
│                  ↑                                           │
│  [Level B] ← [HUB] → [Level C]                              │
│                  ↓                                           │
│              [Level D]                                       │
│                                                              │
│  PROS: Player choice, non-linear progression                │
│  CONS: Can feel disconnected                                │
│  BEST FOR: RPGs, Metroidvanias, open-world                 │
└─────────────────────────────────────────────────────────────┘

METROIDVANIA:
┌─────────────────────────────────────────────────────────────┐
│  ┌───┐   ┌───┐   ┌───┐                                      │
│  │ A │───│ B │───│ C │ (locked: need ability X)            │
│  └─┬─┘   └───┘   └───┘                                      │
│    │       │                                                 │
│  ┌─┴─┐   ┌─┴─┐                                              │
│  │ D │───│ E │ (grants ability X)                          │
│  └───┘   └───┘                                              │
│                                                              │
│  PROS: Rewarding exploration, ability gating                │
│  CONS: Can get lost, backtracking tedium                   │
│  BEST FOR: Exploration games, 2D platformers               │
└─────────────────────────────────────────────────────────────┘
```

## Pacing & Flow

```
INTENSITY GRAPH (Good Pacing):
┌─────────────────────────────────────────────────────────────┐
│  High │      ╱╲           ╱╲    ╱╲                          │
│       │     ╱  ╲    ╱╲   ╱  ╲  ╱  ╲    ╱╲                  │
│       │    ╱    ╲  ╱  ╲ ╱    ╲╱    ╲  ╱  ╲                 │
│  Low  │───╱──────╲╱────╲──────────────╲╱────────           │
│       └────────────────────────────────────────→ Time       │
│                                                              │
│  PATTERN: Build → Peak → Rest → Build → Peak → Rest        │
└─────────────────────────────────────────────────────────────┘

PACING ELEMENTS:
┌─────────────────────────────────────────────────────────────┤
│  BUILD-UP:                                                   │
│  • Introduce new mechanic safely                            │
│  • Increase difficulty gradually                            │
│  • Foreshadow upcoming challenge                            │
├─────────────────────────────────────────────────────────────┤
│  PEAK (Combat/Puzzle):                                       │
│  • Test player skills                                       │
│  • High stakes moments                                      │
│  • Boss encounters                                          │
├─────────────────────────────────────────────────────────────┤
│  REST:                                                       │
│  • Safe zones                                               │
│  • Story/exploration moments                                │
│  • Resource replenishment                                   │
│  • Save points                                              │
└─────────────────────────────────────────────────────────────┘
```

## Environmental Storytelling

```
STORYTELLING TECHNIQUES:
┌─────────────────────────────────────────────────────────────┐
│  VISUAL NARRATIVES:                                          │
│  • Abandoned objects tell stories                           │
│  • Environmental damage shows history                       │
│  • Character belongings reveal personality                  │
│  • Graffiti and notes provide context                       │
├─────────────────────────────────────────────────────────────┤
│  ATMOSPHERE:                                                 │
│  • Lighting sets mood (warm=safe, cold=danger)             │
│  • Sound design reinforces tone                             │
│  • Weather reflects narrative beats                         │
│  • Music cues emotional state                               │
├─────────────────────────────────────────────────────────────┤
│  DISCOVERY LAYERS:                                           │
│  • Surface: Obvious story elements                          │
│  • Hidden: Rewards for exploration                          │
│  • Deep: Lore for dedicated players                         │
└─────────────────────────────────────────────────────────────┘
```

## Whitebox Process

```
LEVEL DESIGN WORKFLOW:
┌─────────────────────────────────────────────────────────────┐
│  1. CONCEPT (Paper)                                          │
│     • Sketch rough layout                                   │
│     • Define key beats                                      │
│     • Identify player path                                  │
│                    ↓                                         │
│  2. WHITEBOX (Engine)                                        │
│     • Block out with primitives                             │
│     • Test scale and timing                                 │
│     • Place placeholder enemies                             │
│                    ↓                                         │
│  3. PLAYTEST                                                 │
│     • Get feedback early                                    │
│     • Iterate on layout                                     │
│     • Fix flow issues                                       │
│                    ↓                                         │
│  4. ART PASS                                                 │
│     • Replace with final art                                │
│     • Add lighting                                          │
│     • Polish visual details                                 │
│                    ↓                                         │
│  5. FINAL POLISH                                             │
│     • Audio integration                                     │
│     • VFX placement                                         │
│     • Performance optimization                              │
└─────────────────────────────────────────────────────────────┘
```

## Player Guidance

```
VISUAL GUIDANCE TECHNIQUES:
┌─────────────────────────────────────────────────────────────┐
│  LIGHTING:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     [Dark]    [BRIGHT PATH]    [Dark]               │   │
│  │                    ↓                                  │   │
│  │              [OBJECTIVE]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  LANDMARKS:                                                  │
│  • Tall structures visible from distance                    │
│  • Unique colors for important locations                    │
│  • Repeated motifs for path clarity                         │
│                                                              │
│  ARCHITECTURE:                                               │
│  • Lines leading to objectives                              │
│  • Framing important elements                               │
│  • Negative space around key items                          │
└─────────────────────────────────────────────────────────────┘
```

## Difficulty Progression

```
TEACHING THROUGH DESIGN:
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Safe Introduction                                   │
│  ┌─────────────────────────────────────────────┐           │
│  │  [Player] ──→ [Gap] ──→ [Platform]          │           │
│  │  (No enemies, can't die)                    │           │
│  └─────────────────────────────────────────────┘           │
│                                                              │
│  STEP 2: Add Stakes                                          │
│  ┌─────────────────────────────────────────────┐           │
│  │  [Player] ──→ [Gap+Spikes] ──→ [Platform]   │           │
│  │  (Same mechanic, consequence for failure)   │           │
│  └─────────────────────────────────────────────┘           │
│                                                              │
│  STEP 3: Add Complexity                                      │
│  ┌─────────────────────────────────────────────┐           │
│  │  [Player] ──→ [Moving Platform] ──→ [Goal]  │           │
│  │  (Timing + previously learned jump)         │           │
│  └─────────────────────────────────────────────┘           │
│                                                              │
│  STEP 4: Combine Mechanics                                   │
│  ┌─────────────────────────────────────────────┐           │
│  │  [Player] ──→ [Enemy] + [Gap] ──→ [Reward]  │           │
│  │  (Combat + platforming together)            │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## BAD/GOOD Level Design Patterns

**BAD** - Invisible wall blocking exploration:
```gdscript
# Player hits invisible collider, no feedback
func _physics_process(delta):
    if position.x > boundary_x:
        position.x = boundary_x  # Silent clamp
```

**GOOD** - Natural boundary with visual/narrative justification:
```gdscript
# Collapsed bridge blocks path, shows reason visually
@onready var rubble_particles: GPUParticles3D = $RubbleParticles
@onready var dialogue: DialogueManager = $DialogueManager

func _on_boundary_entered(body: Node3D) -> void:
    if body.is_in_group("player"):
        rubble_particles.emitting = true
        dialogue.show("The bridge collapsed. I need to find another way around.")
```

**BAD** - All enemies placed randomly:
```csharp
// Scatter enemies with no design intent
for (int i = 0; i < 20; i++)
    Instantiate(enemy, Random.insideUnitSphere * 50, Quaternion.identity);
```

**GOOD** - Enemy placement teaches mechanics:
```csharp
// Place encounters that escalate: solo → pair → group
void PlaceEncounters()
{
    // Room 1: Single weak enemy (teaches combat basics)
    SpawnEnemy(EnemyType.Grunt, room1Center);

    // Room 2: Two enemies (teaches crowd control)
    SpawnEnemy(EnemyType.Grunt, room2Left);
    SpawnEnemy(EnemyType.Grunt, room2Right);

    // Room 3: Mixed types (tests mastery)
    SpawnEnemy(EnemyType.Grunt, room3Front);
    SpawnEnemy(EnemyType.Ranged, room3Back); // Forces movement
    SpawnEnemy(EnemyType.Shield, room3Center); // Forces new tactic
}
```

## Troubleshooting

```
┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Players get lost                                   │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Add stronger visual guides (lighting, landmarks)          │
│ → Use environmental cues (footprints, trails)               │
│ → Place NPCs or signs at decision points                    │
│ → Add map/compass UI elements                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Level feels too long/boring                        │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Add more pacing variety (peaks and valleys)               │
│ → Cut redundant sections                                    │
│ → Add shortcuts for backtracking                            │
│ → Place more rewards and discoveries                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Difficulty spikes frustrating players              │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Add training area before hard section                     │
│ → Place checkpoint closer to challenge                      │
│ → Provide optional resources before boss                    │
│ → Playtest with different skill levels                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Players skip optional content                      │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Make secrets more visible (partial reveal)                │
│ → Place rewards near critical path                          │
│ → Use audio cues for hidden areas                           │
│ → Reward exploration with meaningful items                  │
└─────────────────────────────────────────────────────────────┘
```

## Level Metrics

| Metric | Action | Puzzle | RPG | Platformer |
|--------|--------|--------|-----|------------|
| Avg. Completion | 5-10 min | 10-20 min | 30-60 min | 3-8 min |
| Deaths/Level | 2-5 | 0-2 | 1-3 | 5-15 |
| Secrets | 2-3 | 1-2 | 5-10 | 3-5 |
| Checkpoints | Every 2 min | Puzzle start | Safe rooms | Every 30 sec |

## Procedural Generation with Seeds

```gdscript
# ✅ Production-Ready: Noise-Based Level Generator
extends Node2D

@export var seed_value: int = 12345
@export var grid_size: Vector2i = Vector2i(50, 50)
@export var wall_threshold: float = 0.3

var noise: FastNoiseLite

func _ready() -> void:
    generate_level(seed_value)

func generate_level(level_seed: int) -> void:
    # Initialize noise with seed
    noise = FastNoiseLite.new()
    noise.seed = level_seed
    noise.noise_type = FastNoiseLite.TYPE_PERLIN
    noise.frequency = 0.05

    # Generate tilemap
    for x in range(grid_size.x):
        for y in range(grid_size.y):
            var noise_value = noise.get_noise_2d(x, y)

            # Map noise to tile types
            if noise_value < -wall_threshold:
                place_tile(x, y, "wall")
            elif noise_value > wall_threshold:
                place_tile(x, y, "water")
            else:
                place_tile(x, y, "floor")

                # Spawn entities on floor tiles
                if noise_value > 0.2 and randf() < 0.05:
                    spawn_enemy(Vector2(x, y))

func place_tile(x: int, y: int, type: String) -> void:
    # Implementation depends on your tilemap setup
    pass

func spawn_enemy(pos: Vector2) -> void:
    # Spawn enemy at position
    pass
```

```csharp
// Unity: Perlin noise dungeon generator
public class ProceduralDungeon : MonoBehaviour
{
    [SerializeField] private int seed = 12345;
    [SerializeField] private Vector2Int gridSize = new(50, 50);
    [SerializeField] private float scale = 0.1f;

    void Start()
    {
        GenerateDungeon(seed);
    }

    void GenerateDungeon(int dungeonSeed)
    {
        Random.InitState(dungeonSeed);

        for (int x = 0; x < gridSize.x; x++)
        {
            for (int y = 0; y < gridSize.y; y++)
            {
                // Perlin noise returns 0-1
                float noiseValue = Mathf.PerlinNoise(x * scale, y * scale);

                if (noiseValue < 0.3f)
                    PlaceTile(x, y, TileType.Wall);
                else if (noiseValue < 0.7f)
                    PlaceTile(x, y, TileType.Floor);
                else
                    PlaceTile(x, y, TileType.Treasure);
            }
        }
    }
}
```

---

**Use this skill**: When designing engaging levels, pacing gameplay, or creating environmental narratives.
