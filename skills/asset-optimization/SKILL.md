---
name: asset-optimization
description: Optimize game assets through compression, format conversion, and streaming. Covers textures, meshes, audio, and automated batch processing workflows.
---

# Asset Optimization

## Workflow Overview

Asset optimization follows this 4-step pattern:

1. **Audit** - Identify largest assets, measure load times
2. **Compress** - Apply platform-specific compression
3. **Convert** - Transform to efficient runtime formats
4. **Validate** - Verify quality and measure savings

## Texture Optimization Workflow

### Step 1: Audit Current Usage

```bash
# Find all textures and sort by size
find ./Assets/Textures -type f \( -name "*.png" -o -name "*.tga" \) -exec ls -lh {} \; | sort -k5 -hr | head -20

# Output total size
du -sh ./Assets/Textures
```

### Step 2: Apply Compression

**BAD - Uncompressed RGBA32:**
```
Character_Diffuse.png: 2048x2048, RGBA32
Size: 16 MB
Memory: 16 MB at runtime
```

**GOOD - Platform-optimized BC7:**
```
Character_Diffuse.dds: 2048x2048, BC7
Size: 2 MB
Memory: 2 MB at runtime (8x savings)
```

### Step 3: Batch Convert with texconv

```bash
# Windows - Convert all PNG to BC7 DDS with mipmaps
for file in ./source/*.png; do
    texconv -f BC7 -m 0 -o ./optimized/ "$file"
done

# Mobile - Convert to ASTC 6x6
for file in ./source/*.png; do
    astcenc -cl "$file" ./optimized/$(basename "$file" .png).astc 6x6 -medium
done
```

### Step 4: Validate Quality

```bash
# Compare file sizes
du -sh ./source ./optimized

# Visual diff (requires ImageMagick)
compare -metric PSNR source.png optimized.png diff.png
```

## WebP/AVIF Conversion for Web

### WebP Conversion

```bash
# Single file - 80% quality, lossless alpha
cwebp -q 80 input.png -o output.webp

# Batch convert entire directory
find ./images -name "*.png" -exec bash -c 'cwebp -q 80 "$0" -o "${0%.png}.webp"' {} \;

# With fallback generation
for img in ./images/*.png; do
    cwebp -q 80 "$img" -o "${img%.png}.webp"
    # Keep original as fallback
done
```

**Before/After Example:**
```
hero-banner.png:  1.2 MB (PNG, lossless)
hero-banner.webp: 180 KB (WebP, 85% savings)
```

### AVIF Conversion (Better Compression)

```bash
# Install avif encoder
npm install -g @squoosh/cli

# Convert with quality 60 (good balance)
squoosh-cli --avif '{"cqLevel":60}' input.png

# Batch process
find ./images -name "*.png" | xargs squoosh-cli --avif '{"cqLevel":60}'
```

**Compression Comparison:**
```
product-photo.jpg:   450 KB (JPEG)
product-photo.webp:  210 KB (WebP, 53% savings)
product-photo.avif:  120 KB (AVIF, 73% savings)
```

### HTML Picture Element with Fallbacks

```html
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.png" alt="Hero banner" width="1200" height="600">
</picture>
```

## Mesh Optimization Workflow

### Step 1: Analyze Polygon Count

```python
# Blender script - print mesh stats
import bpy
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print(f"{obj.name}: {len(obj.data.polygons)} tris")
```

### Step 2: Generate LODs

**BAD - Single LOD for all distances:**
```
Character.fbx: 80,000 triangles at all distances
Draw calls: 100 characters = 8M triangles/frame
```

**GOOD - Distance-based LODs:**
```
Character_LOD0.fbx: 80,000 tris (0-10m)
Character_LOD1.fbx: 30,000 tris (10-30m)
Character_LOD2.fbx: 10,000 tris (30-60m)
Character_LOD3.fbx:  2,000 tris (60m+)

Draw calls at 30m: 100 characters = 1M triangles/frame (8x savings)
```

### Step 3: Apply Mesh Compression

```csharp
// Unity - Enable mesh compression in import settings
ModelImporter importer = (ModelImporter)assetImporter;
importer.meshCompression = ModelImporterMeshCompression.High;
importer.optimizeMeshPolygons = true;
importer.optimizeMeshVertices = true;
```

## Audio Optimization Workflow

### Step 1: Identify Compression Strategy

```
Music (long, looped):      Vorbis 128-192 kbps, STREAM
SFX (short, one-shot):     ADPCM, DECOMPRESS_ON_LOAD
Voice (dialogue):          Vorbis 96-128 kbps, STREAM
Ambient (background):      Vorbis 96 kbps, STREAM
```

### Step 2: Convert Audio Files

```bash
# Convert WAV to Vorbis OGG
ffmpeg -i music.wav -c:a libvorbis -b:a 128k music.ogg

# Batch convert all music files
for file in ./audio/music/*.wav; do
    ffmpeg -i "$file" -c:a libvorbis -b:a 128k "${file%.wav}.ogg"
done

# Convert to ADPCM for short SFX
ffmpeg -i sfx.wav -c:a adpcm_ima_wav sfx_compressed.wav
```

**Before/After Example:**
```
background_music.wav: 45 MB (uncompressed PCM)
background_music.ogg:  4 MB (Vorbis 128kbps, 91% savings)
```

### Step 3: Set Unity Import Settings

```csharp
// Unity Editor script - batch configure audio
AudioImporter audioImporter = (AudioImporter)assetImporter;

if (assetPath.Contains("Music"))
{
    audioImporter.loadInBackground = true;
    audioImporter.preloadAudioData = false;
    audioImporter.compressionFormat = AudioCompressionFormat.Vorbis;
    audioImporter.quality = 0.7f; // 128 kbps
}
else if (assetPath.Contains("SFX"))
{
    audioImporter.loadInBackground = false;
    audioImporter.preloadAudioData = true;
    audioImporter.compressionFormat = AudioCompressionFormat.ADPCM;
}
```

## Automated Batch Processing

```python
#!/usr/bin/env python3
# Production-ready asset processor
import subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

PLATFORM_SETTINGS = {
    'pc': {'format': 'bc7', 'max_size': 4096, 'quality': 'high'},
    'mobile': {'format': 'astc', 'max_size': 1024, 'quality': 'medium'},
    'console': {'format': 'bc7', 'max_size': 2048, 'quality': 'high'},
}

def compress_texture(input_path: Path, output_path: Path, platform: str):
    """Compress single texture for target platform."""
    config = PLATFORM_SETTINGS[platform]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        'texconv',
        '-f', config['format'],
        '-w', str(config['max_size']),
        '-h', str(config['max_size']),
        '-m', '0',  # Generate all mipmaps
        '-sepalpha',  # Separate alpha channel
        '-o', str(output_path.parent),
        str(input_path)
    ]

    subprocess.run(cmd, check=True, capture_output=True)

    # Report savings
    original_size = input_path.stat().st_size
    compressed_size = output_path.stat().st_size
    savings = (1 - compressed_size / original_size) * 100
    print(f"{input_path.name}: {savings:.1f}% savings")

def batch_process(input_dir: Path, output_dir: Path, platform: str, workers: int = 8):
    """Process all textures in parallel."""
    textures = list(input_dir.glob('**/*.png')) + list(input_dir.glob('**/*.tga'))

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = []
        for texture in textures:
            rel_path = texture.relative_to(input_dir)
            output_path = output_dir / rel_path.with_suffix('.dds')
            futures.append(executor.submit(compress_texture, texture, output_path, platform))

        # Wait for all
        for future in futures:
            future.result()

if __name__ == '__main__':
    batch_process(
        input_dir=Path('./Assets/Textures/Source'),
        output_dir=Path('./Assets/Textures/Optimized'),
        platform='pc'
    )
```

## Platform-Specific Guidelines

### Mobile Budget

```
Textures:  Max 1024x1024, prefer 512x512
           ASTC 8x8 compression (0.5 bytes/pixel)
           Total budget: 100-500 MB

Meshes:    Characters: 10K tris max
           Props: 500 tris max
           Total scene: 500K tris

Audio:     Vorbis compression required
           Stream files > 200 KB
           Total budget: 20-50 MB
```

### Console/PC Budget

```
Textures:  Max 4096x4096, common 2048x2048
           BC7 compression (1 byte/pixel)
           Total budget: 2-4 GB

Meshes:    Hero characters: 80-100K tris
           NPCs: 25-30K tris
           Total scene: 8-10M tris

Audio:     Light compression acceptable
           Stream music and voice
           Total budget: 200-500 MB
```

## Quick Reference

**Texture Formats by Platform:**
```
PC/Console: BC7 (best) or BC1/DXT1 (smaller)
iOS:        ASTC 6x6 (balanced) or PVRTC (older)
Android:    ETC2 or ASTC 8x8
Web:        WebP (good) or AVIF (best)
```

**Compression Tools:**
```bash
texconv      # DirectX texture tool (BC7, BC1)
astcenc      # ARM ASTC encoder
cwebp        # Google WebP encoder
squoosh-cli  # Multi-format web optimizer
ffmpeg       # Audio/video conversion
```

**File Size Targets:**
```
Character texture: 1-2 MB (compressed)
Environment texture: 2-4 MB (compressed)
Music track: 3-5 MB (Vorbis)
SFX: 10-100 KB (ADPCM)
```

---

**Use this skill**: When build sizes are too large, assets load slowly, or memory usage is high.
