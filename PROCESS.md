# Process overview

## What I built

A game inspired by another called INSIDE. Simple game - explosion hits - rabbit needs to find its burrow.

## The moments that mattered

Three or four for an assignment; fewer is fine for a weekly prototype. Keep the
list short so each moment has room to do all four jobs:

1. **what happened** 
   Oringially I wanted the game to be based around dogs chasing the rabbit and you (the rabbit) had to escape. However claude isnt very good at animating dogs and after a couple of attempts the animations weren't improving.
2. **what you did instead of the obvious thing**
   Instead of finding more reference images or resources to try to make the animated dogs work, I changed the whole game design. I thought of something that claude could create that would be easier. Explosions rather than a animated attacker made for a simpler danger to the game, easier to animate and control
3. **how you knew it was right** 
   It is often difficult to make claude create/fix something it already failed to do. And using this knowledge it makes it clear when claude is capable of producing something - if it didnt compleelty fail to do so the first time, its clear that you can build on this topic throughout the project. Here claude failed at the dogs completely - but the explosion was almost spot on from the first iteration.
4. **the citation**
   
   [`8f8db9d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-Noah-Martin1/commit/8f8db9d)

> the prompt: remove the dogs. I have crerated a new game design. follow these instructions while making sure you dont go past the 90/100 budget in the comp4020 status line. # Rabbit vs. Nuclear Blast — Game Design & Implementation Brief

# Rabbit vs. Nuclear Blast — Game Design & Implementation Brief

I want you to build/refine my existing simple 2D game into a cinematic, atmospheric game inspired by the visual and emotional style of **INSIDE**.

The game is about a rabbit trapped in a cornfield. A nuclear explosion occurs in the distant background, and the player has **45 seconds to reach the rabbit's burrow before the shockwave reaches them**.

The game should remain **simple and immediately understandable**. Do not add complicated systems, inventories, enemies, puzzles, branching paths, or unnecessary mechanics.

## Core Gameplay

The player controls a rabbit moving through a 2D side-view cornfield.

The main gameplay loop is:

**Explore → avoid obstacles → react to shockwaves → reach the burrow before time runs out.**

The game should feel tense and cinematic rather than mechanically complicated.

---

# Opening / Idle State

When the game first loads:

- The rabbit is standing idle.
- The rabbit should have a subtle idle animation:
  - small breathing movement
  - slight body/head movement
  - occasional ear movement
- The corn crops should gently sway in the wind.
- Dust particles should subtly move through the scene.
- The environment should feel calm and quiet.
- The nuclear explosion has NOT happened yet.
- There is no timer visible.
- The player should immediately understand that they can control the rabbit.

The game should essentially be an atmospheric idle scene until the player moves the rabbit.

---

# Game Start

The game begins when the player first moves the rabbit.

Once the rabbit starts moving:

**Start a 5-second delay.**

During those 5 seconds:

- The player can continue moving the rabbit.
- The environment remains relatively calm.
- Build subtle anticipation.

After approximately 5 seconds:

## Nuclear Explosion

A nuclear explosion occurs in the **far background**, behind the cornfield.

The explosion should be large and visually striking, but initially distant.

The explosion should include:

- bright flash
- expanding fireball
- rising mushroom cloud
- distant smoke
- subtle lighting change across the environment
- atmospheric haze
- slight screen/environment response

The explosion should remain visible in the background for the rest of the gameplay.

The explosion is the source of the approaching shockwaves.

---

# Timer

Immediately after the nuclear explosion begins, display a **45-second countdown timer**.

Place the timer in the **top-right corner**.

The timer should visually feel like part of the game world/UI rather than a generic HTML timer.

Style:

- red
- slightly distressed / industrial / military / bomb-style typography
- subtle red glow
- strong enough contrast to remain readable
- slightly ominous
- no overly modern UI styling

Example:

**00:45**

Then:

**00:44**

**00:43**

etc.

As the timer approaches zero, increase the visual urgency slightly.

For example:

- subtle glow becomes stronger
- timer could pulse slightly
- final 10 seconds become more intense

Do not make the timer obnoxious.

---

# Player Movement

The rabbit should have simple platformer-style movement.

The player should be able to:

- move left/right
- jump
- potentially crouch/hide if useful for the shockwave mechanic

Keep movement responsive and simple.

The rabbit should feel small and vulnerable compared with the environment.

---

# Obstacles

The foreground should contain simple physical obstacles that the rabbit must navigate.

Examples:

### Logs
- Fallen logs lying across the ground.
- Rabbit must jump over them.

### Rocks
- Different sized rocks.
- Small rocks can be jumped over.
- Larger rocks can act as environmental cover.

### Fences
- Broken wooden fences.
- Rabbit must jump over them.

The obstacles should be placed naturally throughout the cornfield rather than feeling like an obvious platformer obstacle course.

Do NOT make the level overly difficult.

The challenge should come primarily from the ticking timer and shockwaves.

---

# Shockwave Mechanic

The nuclear explosion periodically sends visible shockwaves toward the rabbit.

This should be one of the game's main mechanics.

The player should receive a clear visual warning before a shockwave reaches them.

### Shockwave visual

A visible wave should travel horizontally through the environment from the distant explosion toward the player.

The wave could be represented by:

- distortion
- dust
- atmospheric ripple
- bright/white pressure wave
- subtle horizontal displacement
- particles being pushed through the environment

It should feel like a massive pressure wave moving through the field.

---

# Corn Reaction

The corn crops should react strongly when the shockwave passes.

Normally:

- corn gently sways in the wind.

When the shockwave approaches:

1. The corn begins reacting.
2. A strong pulse moves through the cornfield.
3. Corn bends/shakes as the wave passes.
4. Dust and particles are pushed.
5. The wave continues toward the rabbit.
6. After the wave passes, the corn gradually settles back down.

The reaction should visually travel through the field so the player can see the shockwave coming.

This is important.

The player should be able to recognize:

**"The shockwave is coming — I need to get behind cover."**

---

# Shockwave Cover

Add environmental objects in the **background/foreground composition** that the rabbit can hide behind to survive the shockwave.

Examples:

### 44-gallon drums
Large industrial metal barrels.

### Water tank
A large agricultural water tank.

### Large boulder
A large natural rock.

### Other suitable objects
You can add a few similar objects if they fit naturally into the environment.

These objects should be large enough that the rabbit can visually shelter behind them.

The important distinction is that these are NOT normal jump obstacles.

They serve as **shockwave cover**.

The player should be able to position the rabbit behind one of these objects when a shockwave arrives.

---

# Cover Mechanic

Keep this extremely simple.

When the shockwave reaches the rabbit:

### If the rabbit is exposed:
- rabbit gets knocked down / pushed back
- loses some time or suffers a significant movement penalty
- dramatic visual/audio feedback

### If the rabbit is behind appropriate cover:
- the object blocks/protects the rabbit
- the rabbit survives the shockwave
- the shockwave visibly passes around/over the cover

The player should be able to understand this naturally without needing a tutorial.

The first shockwave should be forgiving enough that the player can learn the mechanic.

---

# Level Design

The level should be a **single continuous 2D side-scrolling environment**.

Do NOT create multiple complicated paths.

Instead, create a straightforward journey through the cornfield with:

- logs
- rocks
- fences
- large cover objects
- corn
- occasional open areas
- the burrow somewhere ahead

The player should constantly be moving toward the burrow while reacting to obstacles and shockwaves.

The environment should feel like a real abandoned agricultural field rather than a collection of game platforms.

---

# The Burrow

Create a clearly recognizable rabbit burrow near the end of the level.

The burrow should be:

- partially hidden in the ground
- surrounded by dirt
- dark inside
- appropriately sized for the rabbit
- visually distinct enough that the player recognizes it as the goal

It should feel like a natural rabbit burrow rather than a glowing game-object marker.

When the rabbit reaches the burrow:

- trigger the success state
- rabbit enters/disappears into the burrow
- nuclear blast/shockwave continues in the background
- transition to a simple success/end screen or cinematic moment

Do NOT put a giant "GO HERE" marker over the burrow.

The player should discover it naturally.

---

# Visual Direction

The overall aesthetic should be heavily inspired by the **mood and visual language of INSIDE**, without directly copying its assets.

Focus on:

- strong silhouettes
- muted environment
- atmospheric depth
- cinematic composition
- dark foreground
- hazy background
- subtle environmental animation
- minimal UI
- strong contrast
- realistic movement
- restrained visual effects

The rabbit should remain visually readable against the environment.

The nuclear explosion should provide a dramatic contrast to the otherwise muted scene.

---

# Animation / Atmosphere

The environment should never feel completely static.

Add subtle ambient animation:

- corn swaying
- dust drifting
- rabbit breathing
- rabbit ears moving
- distant smoke
- explosion movement
- atmospheric particles
- occasional environmental movement

These animations should be subtle.

Avoid making everything constantly move.

The contrast between the calm opening and the chaotic nuclear event is important.

---

# Overall Game Flow

The final experience should follow this sequence:

### 1. Opening

Rabbit standing idle in cornfield.

Corn gently sways.

Dust floats through the air.

No timer.

No explosion.

Calm atmosphere.

### 2. Player moves

Player gains control of the rabbit.

The game detects the first movement.

Start 5-second countdown internally.

### 3. Nuclear explosion

After 5 seconds:

**BOOM**

A distant nuclear explosion appears.

The environment briefly flashes.

The mushroom cloud begins rising.

### 4. Timer appears

Display:

**00:45**

in the top-right corner.

Countdown begins.

### 5. Escape

Player moves through the cornfield.

They must:

- jump over logs
- jump over rocks
- jump over fences
- navigate around large objects
- identify suitable cover

### 6. Shockwaves

Periodic nuclear shockwaves travel through the environment.

The player sees:

- distant warning
- corn bending
- dust moving
- visible wave
- wave approaching rabbit

The player needs to get behind:

- barrels
- water tank
- boulder
- other large environmental cover

### 7. Continue

The player continues toward the burrow while the timer decreases.

The environment becomes increasingly chaotic as the explosion gets closer.

### 8. Goal

The rabbit reaches the burrow.

The rabbit enters.

The player survives.

Trigger the ending.

---

# Important Design Principle

**Keep it simple.**

This should feel like a small, polished atmospheric game rather than a large game with lots of mechanics.

The player should understand the entire game within the first minute:

> **Run to the burrow. Jump over obstacles. Hide behind big objects when the shockwave comes. Don't run out of time.**

Prioritize:

1. Game feel
2. Atmosphere
3. Rabbit animation
4. Corn/environment animation
5. Nuclear explosion
6. Shockwave visual effect
7. Clear timer
8. Simple obstacles
9. Clear burrow goal

Do not add unnecessary mechanics unless they significantly improve this core experience.

## Implementation Request

First inspect the existing project and understand its current architecture, rendering system, game loop, player controls, collision system, and asset structure.

Then implement the above design **using the existing architecture wherever possible** rather than unnecessarily rewriting the project.

Keep the code clean, modular, and easy to modify.

Before making major architectural changes, consider whether the existing implementation can support the requested features with smaller additions.


