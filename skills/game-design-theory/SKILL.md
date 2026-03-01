---
name: game-design-theory
description: Comprehensive game design theory covering MDA framework, player psychology, balance principles, and progression systems. Master why games are fun.
---

# Game Design Theory

Apply the MDA framework, core loop design, balance tuning, and player feedback as procedural workflows. Every design decision must trace from Aesthetics back to Mechanics.

## MDA Design Workflow

Follow this sequence when designing or evaluating any game system.

1. Define the target Aesthetic (the feeling you want players to have)
2. Identify the Dynamics that produce that feeling (emergent behavior)
3. Design Mechanics that generate those dynamics (rules, constraints, actions)
4. Playtest. Observe whether the actual aesthetic matches the target
5. If mismatch: adjust mechanics, not aesthetics. Never chase a feeling by adding content

```
# MDA traceability check
aesthetic = "tension"          # What the player should feel
dynamic   = "resource scarcity under time pressure"
mechanic  = "ammo caps + respawn timer + shrinking zone"

# Validate: does the mechanic chain produce the aesthetic?
# If players feel frustration instead of tension, the mechanic is wrong.
```

**BAD: Designing mechanics first, hoping fun emerges**
```
# No target aesthetic. Just adding systems.
add_system("crafting")
add_system("skill_tree")
add_system("pet_companion")
# Result: bloated, unfocused, "wide as an ocean, deep as a puddle"
```

**GOOD: Aesthetic-first design**
```
target_aesthetic = "mastery and flow"
# What dynamics create mastery? Tight input-to-outcome loops with escalating challenge.
mechanic_jump    = { height: variable, cost: none, recovery: 0.1s }
mechanic_enemy   = { pattern: learnable, telegraph: 0.4s, punish_window: 0.2s }
# Every mechanic exists because it serves the target feeling.
```

## Core Loop Design Process

Design the loop players repeat every 10-60 seconds. This is the heartbeat of your game.

1. Define the action (what the player does)
2. Define the feedback (what happens within 100ms)
3. Define the reward (what the player gains)
4. Define the escalation (why they do it again, harder)
5. Test loop in isolation before building anything else

```
# Core loop template
loop:
  action    -> player swings sword
  feedback  -> hit flash, damage number, screen shake (< 100ms)
  reward    -> XP tick, loot drop chance, combo counter increment
  escalate  -> enemies get tougher, combos unlock new moves
  repeat    -> next enemy group, higher stakes
```

**BAD: Slow feedback, unclear causation**
```
# Player kills enemy. Nothing happens for 2 seconds.
# XP bar updates silently. No particle effect. No sound.
# Player doesn't connect action to reward. Loop breaks.
on_enemy_death():
    player.xp += 10          # silent update
    save_to_database()        # 2 second delay
```

**GOOD: Immediate, layered feedback**
```
on_enemy_death():
    play_sound("impact_crunch")                    # 0ms
    spawn_particles(enemy.pos, "burst_gold")       # 0ms
    show_damage_number(enemy.pos, damage)          # 0ms
    animate_xp_bar(player.xp, player.xp + 10)     # 50ms ease
    if check_level_up(player):
        trigger_level_up_fanfare()                 # 200ms delay, big moment
```

## Balance Tuning Methodology

Follow this process when tuning numbers. Never guess. Always model, then validate with data.

1. Build a spreadsheet model of the system (damage, health, economy)
2. Calculate time-to-kill, time-to-level, resource earn-rate vs spend-rate
3. Run simulations or paper playtests against target benchmarks
4. Collect real playtest data. Compare to model predictions
5. Adjust in small increments (5-15% per pass). Large swings mask root causes

### Damage Calculation

```
base_damage  = weapon_power * (1 + attack_stat / 100)
final_damage = base_damage * (1 - defense / (defense + 100))

# Example: 50 power, 75 attack, 30 defense
# base  = 50 * 1.75 = 87.5
# final = 87.5 * (1 - 30/130) = 67.3
# Time-to-kill = enemy_hp / final_damage. Target: 2-4 hits for trash, 10+ for bosses.
```

### XP Curve

```
xp_for_level(n) = base * (n ** growth)
# growth = 1.5 (gentle), 2.0 (standard), 2.5 (steep)

# Standard curve at growth=2.0, base=100:
# Level 1:  100 XP    Level 5:  2500 XP
# Level 10: 10000 XP  Level 20: 40000 XP

# Tuning rule: time-per-level should increase 15-25% per level.
# If it doubles, your curve is too steep. Players will churn at the midgame.
```

**BAD: Flat difficulty, no escalation**
```
# Every enemy has the same stats. Player power scales but challenge doesn't.
# By level 5, everything is trivial. Player quits from boredom.
enemy_hp = 100      # constant forever
player_damage = level * 10  # grows without limit
```

**GOOD: Difficulty curve tracks player power**
```
enemy_hp(zone)    = base_hp * (1.12 ** zone)     # 12% per zone
enemy_damage(zone)= base_dmg * (1.10 ** zone)    # 10% per zone
player_power(lvl) = base_power * (1.11 ** lvl)   # 11% per level

# Player stays slightly ahead. Challenge is real but manageable.
# Boss zones spike to 1.5x normal, then drop back. Creates rhythm.
```

## Player Feedback Implementation

Use this checklist when implementing feedback for any player action.

1. Identify every action the player can take
2. For each action, define feedback in three tiers:
   - Tier 1 (0ms): visual flash, sound cue, controller rumble
   - Tier 2 (50-200ms): particle effect, UI update, camera response
   - Tier 3 (500ms+): reward popup, stat change, state transition
3. Test with audio muted. If the action still feels responsive, tier 1 visuals work
4. Test with eyes closed. If the action still feels responsive, tier 1 audio works
5. Remove feedback one layer at a time until the action feels flat. That's your minimum

**BAD: All feedback is the same weight**
```
# Every action gets the same screen shake, same sound, same particle.
# Player can't distinguish important events from noise.
on_any_action():
    screen_shake(0.5)
    play_sound("generic_hit")
    spawn_particles("default")
```

**GOOD: Feedback scales with significance**
```
on_light_attack_hit():
    screen_shake(0.05)
    play_sound("tap_light")
    spawn_particles("small_spark", count=3)

on_critical_hit():
    screen_shake(0.3)
    play_sound("impact_heavy")
    spawn_particles("burst_fire", count=20)
    pause_frame(0.05)          # hit stop, sells the impact
    camera_zoom(0.95, 0.1)     # subtle zoom in, 100ms

on_boss_kill():
    screen_shake(0.8)
    play_sound("boss_death_fanfare")
    slow_motion(0.2, duration=1.5)
    spawn_particles("explosion_gold", count=100)
    camera_cinematic("pull_back_wide")
```

## Reward Loop Design

1. Map all sources of rewards (kills, quests, exploration, time)
2. Assign each a value tier: small (per-action), medium (per-session-goal), large (milestone)
3. Schedule small rewards on a fixed ratio (every N actions)
4. Schedule medium rewards as milestone completions
5. Schedule large rewards at progression gates (new zone, new ability)
6. Never use variable-ratio schedules on monetized rewards. That is a loot box

**BAD: Front-loaded rewards that dry up**
```
# Player gets 10 rewards in first hour, then 1 per hour after.
# Dopamine cliff. Player feels the game "got worse."
rewards_per_hour = [10, 8, 3, 1, 1, 1, 1]  # severe dropoff
```

**GOOD: Consistent reward density with periodic spikes**
```
# Steady drip with milestone peaks. Player always has something close.
rewards_per_hour = [6, 5, 5, 8, 5, 5, 5, 10, 5, 5]
#                              ^milestone     ^boss clear
# Rule: never go more than 3 minutes without some reward signal.
# Reward can be small (resource pickup) but must exist.
```

## Diagnostic: Players Not Having Fun

When playtesters report boredom or frustration, run this diagnostic.

1. Check the core loop. Is feedback under 100ms? Is the action-reward chain obvious?
2. Check the flow channel. Plot player skill vs challenge. Are they matched?
3. Check reward pacing. Graph rewards-over-time. Any dead zones longer than 3 minutes?
4. Check player agency. Does the player have meaningful choices, or is there one optimal path?
5. Check clarity. Can a new player explain what they're supposed to do within 30 seconds?

```
# Quick diagnostic pseudocode
def diagnose(playtest_data):
    if avg_feedback_latency > 100:       return "FIX: feedback too slow"
    if challenge_delta > 0.3:            return "FIX: difficulty spike"
    if max_reward_gap > 180:             return "FIX: reward desert"
    if dominant_strategy_usage > 0.7:    return "FIX: balance, buff alternatives"
    if tutorial_completion_rate < 0.5:   return "FIX: onboarding clarity"
    return "PASS: look deeper at content quality"
```
