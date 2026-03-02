---
name: godot-4
description: Godot 4 game dev with GDScript 2.0, scene architecture, physics, signals, and performance patterns
user-invokable: true
---

# Godot 4 Development Skill

Expert guidance for Godot 4 game development using GDScript 2.0, scene composition, physics systems, and performance optimization.

## GDScript 2.0 Typed Syntax

Always use static typing for performance and IDE support.

**BAD:** Untyped variables and functions
```gdscript
var health = 100
var player
var enemies = []

func take_damage(amount):
    health -= amount
    return health <= 0
```

**GOOD:** Fully typed with explicit return types
```gdscript
var health: int = 100
var player: CharacterBody2D
var enemies: Array[Enemy] = []

func take_damage(amount: int) -> bool:
    health -= amount
    return health <= 0
```

## @export and @onready Patterns

Use typed @export for inspector values and @onready for node references.

**BAD:** Untyped exports, get_node in _ready
```gdscript
@export var speed = 300
@export var jump_force = -400

var sprite
var collision

func _ready():
    sprite = get_node("Sprite2D")
    collision = get_node("CollisionShape2D")
```

**GOOD:** Typed exports with hints, @onready with type annotations
```gdscript
@export_range(100, 500, 10) var speed: float = 300.0
@export_range(-800, -200, 50) var jump_force: float = -400.0
@export var gravity: float = 980.0

@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D
@onready var animation: AnimationPlayer = $AnimationPlayer
```

## Scene Composition and Node Architecture

Structure games as composable scenes, not monolithic scripts.

**BAD:** Monolithic player script handling everything
```gdscript
extends CharacterBody2D

var health = 100
var ammo = 30
var inventory = []

func _process(delta):
    update_health_bar()
    update_ammo_display()
    update_inventory_ui()
    check_pickups()
    handle_combat()
```

**GOOD:** Component-based scene composition
```gdscript
# Player.gd
extends CharacterBody2D
class_name Player

@onready var health_component: HealthComponent = $HealthComponent
@onready var inventory_component: InventoryComponent = $InventoryComponent
@onready var weapon_component: WeaponComponent = $WeaponComponent

func _ready() -> void:
    health_component.died.connect(_on_died)
    weapon_component.fired.connect(_on_weapon_fired)

func _on_died() -> void:
    animation.play("death")
    set_physics_process(false)
```

```gdscript
# HealthComponent.gd
extends Node
class_name HealthComponent

signal health_changed(new_health: int, max_health: int)
signal died()

@export var max_health: int = 100
var current_health: int

func _ready() -> void:
    current_health = max_health

func take_damage(amount: int) -> void:
    current_health = maxi(0, current_health - amount)
    health_changed.emit(current_health, max_health)

    if current_health == 0:
        died.emit()

func heal(amount: int) -> void:
    current_health = mini(max_health, current_health + amount)
    health_changed.emit(current_health, max_health)
```

## Physics and Movement

Use CharacterBody2D/3D with move_and_slide, handle physics in _physics_process.

**BAD:** Movement in _process with position manipulation
```gdscript
extends CharacterBody2D

func _process(delta):
    if Input.is_action_pressed("right"):
        position.x += speed * delta
    if Input.is_action_pressed("jump"):
        position.y -= jump_force
```

**GOOD:** Proper physics with move_and_slide in _physics_process
```gdscript
extends CharacterBody2D

@export var speed: float = 300.0
@export var jump_velocity: float = -400.0
@export var gravity: float = 980.0

func _physics_process(delta: float) -> void:
    # Apply gravity
    if not is_on_floor():
        velocity.y += gravity * delta

    # Handle jump
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_velocity

    # Get input direction
    var direction: float = Input.get_axis("left", "right")

    # Apply movement with acceleration
    if direction != 0.0:
        velocity.x = move_toward(velocity.x, direction * speed, speed * delta * 10.0)
    else:
        velocity.x = move_toward(velocity.x, 0.0, speed * delta * 5.0)

    move_and_slide()
```

## Signal-Based Communication

Use signals for decoupled component communication, avoid direct references.

**BAD:** Direct node path access and method calls
```gdscript
# Enemy.gd
func die():
    get_node("/root/GameManager").add_score(100)
    get_node("../UI/ScoreLabel").update_display()
    queue_free()
```

**GOOD:** Signal-based event system
```gdscript
# Enemy.gd
extends CharacterBody2D

signal died(score_value: int)

@export var score_value: int = 100

func die() -> void:
    died.emit(score_value)
    queue_free()

# GameManager.gd (autoload)
extends Node

signal score_changed(new_score: int)

var score: int = 0

func _ready() -> void:
    # Connect to enemies via groups
    get_tree().node_added.connect(_on_node_added)

func _on_node_added(node: Node) -> void:
    if node.is_in_group("enemies"):
        node.died.connect(_on_enemy_died)

func _on_enemy_died(score_value: int) -> void:
    score += score_value
    score_changed.emit(score)
```

## State Machines

Implement clean state management for complex behaviors.

**BAD:** Nested if statements for state logic
```gdscript
var state = "idle"

func _physics_process(delta):
    if state == "idle":
        if see_player:
            state = "chase"
        elif hear_noise:
            state = "investigate"
    elif state == "chase":
        if lost_player:
            state = "idle"
        elif close_to_player:
            state = "attack"
    # ... more nesting
```

**GOOD:** State machine with clear transitions
```gdscript
extends Node
class_name StateMachine

var current_state: State
var states: Dictionary = {}

func _ready() -> void:
    for child in get_children():
        if child is State:
            states[child.name.to_lower()] = child
            child.transitioned.connect(_on_state_transitioned)

    if current_state:
        current_state.enter()

func _physics_process(delta: float) -> void:
    if current_state:
        current_state.physics_update(delta)

func _on_state_transitioned(new_state_name: String) -> void:
    var new_state: State = states.get(new_state_name.to_lower())
    if not new_state or new_state == current_state:
        return

    if current_state:
        current_state.exit()

    current_state = new_state
    current_state.enter()

# Base State class
class_name State
extends Node

signal transitioned(new_state_name: String)

func enter() -> void:
    pass

func exit() -> void:
    pass

func physics_update(delta: float) -> void:
    pass
```

## Resource Management

Use preload for static resources, load() for dynamic content.

**BAD:** Loading resources every frame or in _process
```gdscript
func spawn_enemy():
    var enemy_scene = load("res://enemies/goblin.tscn")
    var enemy = enemy_scene.instantiate()
    add_child(enemy)

func _process(delta):
    var texture = load("res://textures/player.png")
    sprite.texture = texture
```

**GOOD:** Preload static assets, cache dynamic resources
```gdscript
# Preload at compile time
const ENEMY_SCENES: Dictionary = {
    "goblin": preload("res://enemies/goblin.tscn"),
    "orc": preload("res://enemies/orc.tscn"),
    "dragon": preload("res://enemies/dragon.tscn")
}

# Cache for dynamic resources
var resource_cache: Dictionary = {}

func spawn_enemy(type: String) -> void:
    var scene: PackedScene = ENEMY_SCENES.get(type)
    if not scene:
        push_error("Unknown enemy type: %s" % type)
        return

    var enemy: Node = scene.instantiate()
    add_child(enemy)

func load_cached(path: String) -> Resource:
    if not resource_cache.has(path):
        resource_cache[path] = load(path)
    return resource_cache[path]
```

## UI with Control Nodes

Structure UI with proper anchors, containers, and themes.

**BAD:** Hardcoded positions and manual updates
```gdscript
extends Label

func _process(delta):
    position = Vector2(50, 50)
    text = "Health: " + str(player.health)
```

**GOOD:** Anchor-based layout with signal updates
```gdscript
# HealthDisplay.gd
extends HBoxContainer

@onready var health_label: Label = $HealthLabel
@onready var health_bar: ProgressBar = $HealthBar

func _ready() -> void:
    # Anchored top-left with margin
    set_anchors_preset(Control.PRESET_TOP_LEFT)
    offset_left = 20
    offset_top = 20

    # Connect to player health component
    var player: Player = get_tree().get_first_node_in_group("player")
    if player and player.health_component:
        player.health_component.health_changed.connect(_on_health_changed)

func _on_health_changed(current: int, maximum: int) -> void:
    health_label.text = "%d / %d" % [current, maximum]
    health_bar.max_value = maximum
    health_bar.value = current
```

## Animation System

Use AnimationPlayer for complex animations, Tween for simple interpolations.

**BAD:** Manual interpolation in _process
```gdscript
var target_position = Vector2.ZERO
var lerp_speed = 0.1

func _process(delta):
    position = position.lerp(target_position, lerp_speed)
```

**GOOD:** AnimationPlayer for sequences, Tween for runtime animations
```gdscript
# Using AnimationPlayer for attack sequence
@onready var animation_player: AnimationPlayer = $AnimationPlayer

func attack() -> void:
    animation_player.play("attack_combo")
    await animation_player.animation_finished
    can_move = true

# Using Tween for smooth movement
func move_to_position(target: Vector2, duration: float = 0.5) -> void:
    var tween: Tween = create_tween()
    tween.set_ease(Tween.EASE_OUT)
    tween.set_trans(Tween.TRANS_CUBIC)
    tween.tween_property(self, "global_position", target, duration)
    await tween.finished

# Parallel animations with Tween
func show_damage_effect() -> void:
    var tween: Tween = create_tween()
    tween.set_parallel(true)
    tween.tween_property(sprite, "modulate", Color.RED, 0.1)
    tween.tween_property(self, "scale", Vector2(1.2, 1.2), 0.1)
    await tween.finished

    var restore_tween: Tween = create_tween()
    restore_tween.set_parallel(true)
    restore_tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)
    restore_tween.tween_property(self, "scale", Vector2.ONE, 0.1)
```

## Object Pooling for Performance

Pool frequently spawned/destroyed objects to reduce GC pressure.

**BAD:** Constant instantiate/queue_free cycles
```gdscript
func shoot():
    var bullet = bullet_scene.instantiate()
    get_parent().add_child(bullet)
    bullet.global_position = muzzle.global_position

# Bullet.gd
func _on_hit():
    queue_free()
```

**GOOD:** Object pool for reusable instances
```gdscript
# ObjectPool.gd
extends Node
class_name ObjectPool

var scene: PackedScene
var pool: Array[Node] = []
var active: Array[Node] = []
@export var initial_size: int = 20

func _ready() -> void:
    for i in initial_size:
        var instance: Node = scene.instantiate()
        instance.set_process(false)
        instance.hide()
        pool.append(instance)
        add_child(instance)

func get_instance() -> Node:
    var instance: Node
    if pool.is_empty():
        instance = scene.instantiate()
        add_child(instance)
    else:
        instance = pool.pop_back()

    active.append(instance)
    instance.set_process(true)
    instance.show()
    return instance

func return_instance(instance: Node) -> void:
    if instance not in active:
        return

    active.erase(instance)
    pool.append(instance)
    instance.set_process(false)
    instance.hide()

# Usage in weapon
@onready var bullet_pool: ObjectPool = $BulletPool

func shoot() -> void:
    var bullet: Node = bullet_pool.get_instance()
    bullet.global_position = muzzle.global_position
    bullet.hit.connect(func(): bullet_pool.return_instance(bullet))
```

## Performance Profiling

Use built-in profiler and optimization techniques.

```gdscript
# Avoid heavy calculations in _process
func _process(delta: float) -> void:
    # BAD: recalculating every frame
    var distance_to_player: float = global_position.distance_to(player.global_position)
    if distance_to_player < detection_range:
        chase_player()

# GOOD: use VisibleOnScreenNotifier2D and timers
@onready var visibility_notifier: VisibleOnScreenNotifier2D = $VisibleOnScreenNotifier2D
@onready var update_timer: Timer = $UpdateTimer

var is_visible: bool = false

func _ready() -> void:
    visibility_notifier.screen_entered.connect(func(): is_visible = true)
    visibility_notifier.screen_exited.connect(func(): is_visible = false)
    update_timer.timeout.connect(_update_ai)
    update_timer.start()

func _update_ai() -> void:
    if not is_visible:
        return

    var distance_sq: float = global_position.distance_squared_to(player.global_position)
    if distance_sq < detection_range * detection_range:
        chase_player()
```

## Autoloads for Global Systems

Use autoloads for game-wide managers, keep them focused.

```gdscript
# GameManager.gd (autoload)
extends Node

signal game_paused()
signal game_resumed()

var is_paused: bool = false

func pause_game() -> void:
    if is_paused:
        return
    is_paused = true
    get_tree().paused = true
    game_paused.emit()

func resume_game() -> void:
    if not is_paused:
        return
    is_paused = false
    get_tree().paused = false
    game_resumed.emit()

# AudioManager.gd (autoload)
extends Node

const MAX_SOUNDS: int = 16
var audio_players: Array[AudioStreamPlayer] = []
var available_players: Array[AudioStreamPlayer] = []

func _ready() -> void:
    for i in MAX_SOUNDS:
        var player: AudioStreamPlayer = AudioStreamPlayer.new()
        audio_players.append(player)
        available_players.append(player)
        add_child(player)
        player.finished.connect(func(): _on_sound_finished(player))

func play_sound(stream: AudioStream, volume_db: float = 0.0) -> void:
    if available_players.is_empty():
        return

    var player: AudioStreamPlayer = available_players.pop_back()
    player.stream = stream
    player.volume_db = volume_db
    player.play()

func _on_sound_finished(player: AudioStreamPlayer) -> void:
    if player not in available_players:
        available_players.append(player)
```

## Export and Build Configuration

```gdscript
# Project settings for export
# Project > Project Settings > Application
# - Name: "Your Game"
# - Icon: res://icon.svg
# - Main Scene: res://scenes/main_menu.tscn

# Export presets
# Project > Export
# - Windows Desktop: .exe with embedded PCK
# - Linux/X11: universal binary
# - Web (HTML5): WebGL2, specific canvas size

# export_presets.cfg example
[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="builds/windows/game.exe"
encryption_include_filters=""
encryption_exclude_filters=""
script_encryption_key=""

[preset.0.options]
custom_template/debug=""
custom_template/release=""
debug/export_console_script=1
binary_format/embed_pck=true
texture_format/bptc=true
texture_format/s3tc=true
texture_format/etc=false
texture_format/etc2=false
```

## Common Patterns Checklist

1. **Type everything**: variables, parameters, return types, arrays with generics
2. **Use @onready**: for node references with type hints
3. **Signal over direct calls**: emit signals for cross-node communication
4. **Component scenes**: break complex nodes into reusable components
5. **Physics in _physics_process**: movement and collision detection
6. **Preload static assets**: use const and preload() for compile-time loading
7. **Object pooling**: for bullets, particles, enemies spawned frequently
8. **Visibility checks**: don't process offscreen entities
9. **Autoloads for globals**: managers, not game state
10. **Profile regularly**: use built-in profiler, optimize bottlenecks

## Workflow

1. Create scene structure with typed node references
2. Implement component scripts with signals
3. Connect signals in _ready(), not in editor when possible
4. Test physics in isolation before adding gameplay logic
5. Profile with 100+ entities to identify bottlenecks
6. Pool frequently instantiated objects
7. Use animation system for visual feedback
8. Export templates for each target platform
