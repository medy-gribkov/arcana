---
name: graphics-rendering
description: 3D graphics, shaders, VFX, lighting, rendering optimization. Create stunning visuals with production-ready techniques.
---

# Graphics & Rendering

## Rendering Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDERING PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│  VERTEX STAGE:                                               │
│  Model Space → World Space → View Space → Clip Space        │
│                              ↓                               │
│  RASTERIZATION: Triangles → Fragments                       │
│                              ↓                               │
│  FRAGMENT STAGE: Color, Lighting, Texturing                 │
│                              ↓                               │
│  OUTPUT: Final pixel color to framebuffer                   │
└─────────────────────────────────────────────────────────────┘
```

## Shader Programming

### Standard PBR Shader (HLSL)

```hlsl
// ✅ Production-Ready: PBR Surface Shader
struct SurfaceData
{
    float3 Albedo;
    float3 Normal;
    float Metallic;
    float Roughness;
    float AO;
};

float3 FresnelSchlick(float cosTheta, float3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float DistributionGGX(float3 N, float3 H, float roughness)
{
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

float4 PBRLighting(SurfaceData surface, float3 viewDir, float3 lightDir)
{
    float3 H = normalize(viewDir + lightDir);
    float3 F0 = lerp(0.04, surface.Albedo, surface.Metallic);

    float D = DistributionGGX(surface.Normal, H, surface.Roughness);
    float3 F = FresnelSchlick(max(dot(H, viewDir), 0.0), F0);

    float3 diffuse = surface.Albedo * (1.0 - surface.Metallic);
    float3 specular = D * F;

    return float4((diffuse + specular) * surface.AO, 1.0);
}
```

### Toon/Cel Shader

```hlsl
// ✅ Production-Ready: Toon Shader
float4 ToonShading(float3 normal, float3 lightDir, float4 baseColor)
{
    float NdotL = dot(normal, lightDir);

    // Step function for cel shading
    float toonRamp;
    if (NdotL > 0.7) toonRamp = 1.0;
    else if (NdotL > 0.3) toonRamp = 0.6;
    else if (NdotL > 0.0) toonRamp = 0.3;
    else toonRamp = 0.1;

    return baseColor * toonRamp;
}

// Outline pass (inverted hull method)
float4 OutlineVertex(float4 position, float3 normal, float outlineWidth)
{
    position.xyz += normal * outlineWidth;
    return position;
}
```

## Visual Effects (VFX)

### Particle System Setup

```
PARTICLE SYSTEM ARCHITECTURE:
┌─────────────────────────────────────────────────────────────┐
│  EMITTER: Rate, Bursts, Shape                               │
│                    ↓                                         │
│  SPAWN: Initial velocity, Size, Color, Lifetime             │
│                    ↓                                         │
│  UPDATE: Forces, Collisions, Color over life               │
│                    ↓                                         │
│  RENDER: Billboard, Mesh, Trail                             │
└─────────────────────────────────────────────────────────────┘

COMMON VFX RECIPES:
┌────────────────┬────────────────────────────────────────────┐
│ Fire           │ Orange→Yellow gradient, upward velocity   │
│ Smoke          │ Gray billboards, turbulence noise         │
│ Sparks         │ Point emitter, gravity, short lifetime    │
│ Magic          │ Spiral path, glow, color cycling          │
│ Blood          │ Burst, gravity, decal on collision        │
└────────────────┴────────────────────────────────────────────┘
```

## Optimization Techniques

| Technique | Draw Call Reduction | When to Use |
|-----------|---------------------|-------------|
| Static Batching | 90%+ | Static geometry |
| Dynamic Batching | 50-80% | Small moving objects |
| GPU Instancing | 95%+ | Many identical objects |
| LOD System | 40-60% | Distant objects |
| Occlusion Culling | 30-70% | Indoor scenes |

### LOD Configuration

```
LOD DISTANCE SETUP:
┌─────────────────────────────────────────────────────────────┐
│  LOD0 (100% tris): 0-20m   → Full detail                   │
│  LOD1 (50% tris):  20-50m  → Reduced detail                │
│  LOD2 (25% tris):  50-100m → Low detail                    │
│  LOD3 (10% tris):  100m+   → Billboard/Impostor            │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Troubleshooting

```
┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Too many draw calls (>2000)                        │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Enable GPU instancing for repeated objects               │
│ → Use texture atlases                                       │
│ → Merge static meshes                                       │
│ → Implement LOD system                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PROBLEM: Shader artifacts / visual glitches                 │
├─────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                   │
│ → Check for division by zero                                │
│ → Validate normal vectors                                   │
│ → Use saturate() on color outputs                           │
│ → Check texture sampling modes                              │
└─────────────────────────────────────────────────────────────┘
```

## Platform Guidelines

| Platform | Max Draw Calls | Shader Complexity | Texture Size |
|----------|----------------|-------------------|--------------|
| Mobile | 100-200 | Low | 1024px max |
| Console | 2000-3000 | High | 4096px |
| PC | 3000-5000 | Very High | 8192px |
| VR | 100-150 | Low | 2048px |

## WebGPU Shader Example

```wgsl
// ✅ Production-Ready: WebGPU Compute Shader (Particle System)
struct Particle {
    position: vec3<f32>,
    velocity: vec3<f32>,
    life: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> deltaTime: f32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particles)) {
        return;
    }

    var particle = particles[index];

    // Update position
    particle.position += particle.velocity * deltaTime;

    // Apply gravity
    particle.velocity.y -= 9.8 * deltaTime;

    // Reduce life
    particle.life -= deltaTime;

    // Reset if dead
    if (particle.life <= 0.0) {
        particle.position = vec3<f32>(0.0, 5.0, 0.0);
        particle.velocity = vec3<f32>(
            (fract(sin(f32(index) * 12.9898) * 43758.5453) - 0.5) * 2.0,
            5.0,
            (fract(sin(f32(index) * 78.233) * 43758.5453) - 0.5) * 2.0
        );
        particle.life = 3.0;
    }

    particles[index] = particle;
}
```

```typescript
// WebGPU setup (TypeScript)
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: device.createShaderModule({ code: shaderCode }),
    entryPoint: "main",
  },
});

const commandEncoder = device.createCommandEncoder();
const passEncoder = commandEncoder.beginComputePass();
passEncoder.setPipeline(computePipeline);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.dispatchWorkgroups(Math.ceil(particleCount / 64));
passEncoder.end();
device.queue.submit([commandEncoder.finish()]);
```

---

**Use this skill**: When creating shaders, optimizing visuals, or implementing effects.
