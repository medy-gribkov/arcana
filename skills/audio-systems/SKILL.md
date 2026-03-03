---
name: audio-systems
description: Implement spatial audio, adaptive music, and sound effects with Unity, FMOD, and Wwise. Covers 3D positioning, dynamic mixing, and performance optimization.
---

# Audio Systems

## Implementation Workflow

Follow this pattern for professional audio integration:

1. **Architecture** - Set up audio manager and pooling
2. **Integration** - Connect middleware (FMOD/Wwise) or native engine
3. **Spatial** - Configure 3D positioning and attenuation
4. **Mixing** - Balance levels and apply dynamic ducking
5. **Optimization** - Limit voices, compress assets, stream large files

## Unity Native Audio Manager

### Step 1: Create Pooled Audio System

```csharp
// Production-ready audio manager with object pooling
using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    [System.Serializable]
    public class SoundBank
    {
        public string id;
        public AudioClip[] clips;
        [Range(0f, 1f)] public float volume = 1f;
        [Range(0.1f, 3f)] public float pitchVariation = 0.1f;
        public bool spatial = true;
    }

    [SerializeField] private SoundBank[] _soundBanks;
    [SerializeField] private int _poolSize = 20;
    [SerializeField] private AudioMixerGroup _sfxMixer;

    private Dictionary<string, SoundBank> _bankLookup;
    private Queue<AudioSource> _sourcePool;

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        InitializePool();
        BuildLookup();
    }

    public void PlaySound(string id, Vector3 position)
    {
        if (!_bankLookup.TryGetValue(id, out var bank))
        {
            Debug.LogWarning($"Sound '{id}' not found");
            return;
        }

        var source = GetPooledSource();
        source.transform.position = position;
        source.clip = bank.clips[Random.Range(0, bank.clips.Length)];
        source.volume = bank.volume;
        source.pitch = 1f + Random.Range(-bank.pitchVariation, bank.pitchVariation);
        source.spatialBlend = bank.spatial ? 1f : 0f;
        source.outputAudioMixerGroup = _sfxMixer;
        source.Play();

        StartCoroutine(ReturnToPool(source, source.clip.length));
    }

    private void InitializePool()
    {
        _sourcePool = new Queue<AudioSource>();
        for (int i = 0; i < _poolSize; i++)
        {
            _sourcePool.Enqueue(CreateNewSource());
        }
    }

    private void BuildLookup()
    {
        _bankLookup = new Dictionary<string, SoundBank>();
        foreach (var bank in _soundBanks)
        {
            _bankLookup[bank.id] = bank;
        }
    }

    private AudioSource GetPooledSource()
    {
        return _sourcePool.Count > 0 ? _sourcePool.Dequeue() : CreateNewSource();
    }

    private AudioSource CreateNewSource()
    {
        var go = new GameObject("AudioSource");
        go.transform.SetParent(transform);
        return go.AddComponent<AudioSource>();
    }

    private IEnumerator ReturnToPool(AudioSource source, float delay)
    {
        yield return new WaitForSeconds(delay + 0.1f);
        source.Stop();
        _sourcePool.Enqueue(source);
    }
}
```

### Step 2: Use in Gameplay

**BAD - Creating new AudioSource every time:**
```csharp
void PlayExplosion()
{
    var source = gameObject.AddComponent<AudioSource>();
    source.clip = explosionClip;
    source.Play();
    // Memory leak - never cleaned up!
}
```

**GOOD - Using pooled manager:**
```csharp
void PlayExplosion()
{
    AudioManager.Instance.PlaySound("explosion", transform.position);
}
```

## FMOD Integration

### Step 1: Event Player Component

```csharp
using UnityEngine;
using FMODUnity;
using FMOD.Studio;

public class FMODEventPlayer : MonoBehaviour
{
    [SerializeField] private EventReference _eventRef;
    [SerializeField] private bool _playOnStart = false;

    private EventInstance _instance;
    private bool _isPlaying;

    void Start()
    {
        if (_playOnStart) Play();
    }

    public void Play()
    {
        if (_isPlaying) Stop();

        _instance = RuntimeManager.CreateInstance(_eventRef);
        _instance.set3DAttributes(RuntimeUtils.To3DAttributes(transform));
        _instance.start();
        _isPlaying = true;
    }

    public void SetParameter(string name, float value)
    {
        if (_isPlaying)
            _instance.setParameterByName(name, value);
    }

    public void Stop(bool allowFadeout = true)
    {
        if (!_isPlaying) return;

        _instance.stop(allowFadeout
            ? FMOD.Studio.STOP_MODE.ALLOWFADEOUT
            : FMOD.Studio.STOP_MODE.IMMEDIATE);
        _instance.release();
        _isPlaying = false;
    }

    void OnDestroy() => Stop(false);

    void Update()
    {
        if (_isPlaying)
            _instance.set3DAttributes(RuntimeUtils.To3DAttributes(transform));
    }
}
```

### Step 2: Parameter-Driven Music

```csharp
// Adaptive music controller
public class MusicController : MonoBehaviour
{
    private EventInstance _musicInstance;

    void Start()
    {
        _musicInstance = RuntimeManager.CreateInstance("event:/Music/Gameplay");
        _musicInstance.start();
    }

    public void SetCombatIntensity(float intensity)
    {
        // 0.0 = exploration, 1.0 = intense combat
        _musicInstance.setParameterByName("Intensity", intensity);
    }

    public void TriggerVictory()
    {
        _musicInstance.setParameterByName("State", 2); // Victory state
    }
}
```

## Wwise Integration

### Step 1: Post Events

```csharp
using UnityEngine;

public class WwisePlayer : MonoBehaviour
{
    [AkEvent] public string playEvent = "Play_Footstep";
    [AkEvent] public string stopEvent = "Stop_Footstep";

    public void PlayFootstep()
    {
        AkSoundEngine.PostEvent(playEvent, gameObject);
    }

    public void SetSurfaceType(string surface)
    {
        // Switch: Surface = Grass/Metal/Wood
        AkSoundEngine.SetSwitch("Surface", surface, gameObject);
    }

    public void SetPlayerSpeed(float speed)
    {
        // RTPC: PlayerSpeed drives footstep rate
        AkSoundEngine.SetRTPCValue("PlayerSpeed", speed, gameObject);
    }
}
```

### Step 2: Dynamic Music with States

```csharp
public class WwiseMusicManager : MonoBehaviour
{
    void SetGameState(string state)
    {
        // State: GameState = Exploration/Combat/Victory
        AkSoundEngine.SetState("GameState", state);
    }

    void OnPlayerEnterCombat()
    {
        SetGameState("Combat");
    }

    void OnPlayerExitCombat()
    {
        SetGameState("Exploration");
    }
}
```

## Spatial Audio Configuration

### Step 1: Set Attenuation Curves

```csharp
// Configure 3D audio source
AudioSource source = GetComponent<AudioSource>();

// Logarithmic rolloff (realistic)
source.rolloffMode = AudioRolloffMode.Logarithmic;
source.minDistance = 1f;   // Full volume
source.maxDistance = 50f;  // Inaudible
source.spatialBlend = 1f;  // Fully 3D

// Doppler effect for vehicles
source.dopplerLevel = 1.5f;
```

**Distance Attenuation:**
```
Volume
  100% ████████████
        1m    5m   ████
                       ████
                          ████
    0%                       ████
       0m    10m   30m   50m   Distance

Min Distance: 1m (full volume)
Max Distance: 50m (silence)
Rolloff: Logarithmic
```

### Step 2: Spatial Blend Based on Sound Type

**BAD - All sounds fully 3D:**
```csharp
footsteps.spatialBlend = 1f;  // Correct
music.spatialBlend = 1f;      // Wrong - UI sounds shouldn't be 3D
uiClick.spatialBlend = 1f;    // Wrong
```

**GOOD - Appropriate spatial settings:**
```csharp
footsteps.spatialBlend = 1f;   // 3D gameplay
ambientWind.spatialBlend = 1f; // 3D environment
music.spatialBlend = 0f;       // 2D stereo
uiClick.spatialBlend = 0f;     // 2D UI
```

## Dynamic Mixing and Ducking

### Step 1: Mixer Group Setup

```csharp
// Reduce music volume when dialogue plays
using UnityEngine.Audio;

public class AudioDucker : MonoBehaviour
{
    [SerializeField] private AudioMixer _mixer;

    public void OnDialogueStart()
    {
        _mixer.SetFloat("MusicVolume", -10f); // Duck to -10dB
    }

    public void OnDialogueEnd()
    {
        _mixer.SetFloat("MusicVolume", 0f); // Restore to 0dB
    }
}
```

### Step 2: Smooth Volume Transitions

```csharp
public IEnumerator FadeAudioSource(AudioSource source, float targetVolume, float duration)
{
    float startVolume = source.volume;
    float elapsed = 0f;

    while (elapsed < duration)
    {
        elapsed += Time.deltaTime;
        source.volume = Mathf.Lerp(startVolume, targetVolume, elapsed / duration);
        yield return null;
    }

    source.volume = targetVolume;
}
```

## Adaptive Music State Machine

```csharp
// State-driven music system
public enum MusicState { Exploration, Tension, Combat, Victory, Defeat }

public class AdaptiveMusicSystem : MonoBehaviour
{
    private MusicState _currentState = MusicState.Exploration;
    private EventInstance _musicInstance;

    void Start()
    {
        _musicInstance = RuntimeManager.CreateInstance("event:/Music/Adaptive");
        _musicInstance.start();
        TransitionTo(MusicState.Exploration);
    }

    public void TransitionTo(MusicState newState)
    {
        if (_currentState == newState) return;

        // Set FMOD parameter on beat boundary
        _musicInstance.setParameterByName("State", (float)newState);
        _currentState = newState;
    }

    void Update()
    {
        // Drive state from game conditions
        if (PlayerInCombat() && _currentState != MusicState.Combat)
        {
            TransitionTo(MusicState.Combat);
        }
        else if (!PlayerInCombat() && _currentState == MusicState.Combat)
        {
            TransitionTo(MusicState.Exploration);
        }
    }
}
```

**State Transition Flow:**
```
[Exploration] <──> [Tension]
      │                │
      ↓                ↓
 [Discovery]      [Combat]
                       │
                       ↓
                [Victory/Defeat]

Transitions: 2-4 bar crossfades on beat boundaries
```

## Voice Limiting and Priority

```csharp
// Limit simultaneous sounds per category
public class VoiceLimiter : MonoBehaviour
{
    private Dictionary<string, List<AudioSource>> _activeSources = new();
    private int _maxVoicesPerCategory = 4;

    public void PlayLimitedSound(string category, AudioClip clip, Vector3 position)
    {
        if (!_activeSources.ContainsKey(category))
            _activeSources[category] = new List<AudioSource>();

        var sources = _activeSources[category];

        // Remove finished sources
        sources.RemoveAll(s => !s.isPlaying);

        // If at limit, stop oldest
        if (sources.Count >= _maxVoicesPerCategory)
        {
            sources[0].Stop();
            sources.RemoveAt(0);
        }

        // Play new sound
        var newSource = AudioManager.Instance.PlaySound(category, position);
        sources.Add(newSource);
    }
}
```

## Platform-Specific Optimization

### Mobile Settings

```csharp
#if UNITY_ANDROID || UNITY_IOS
    // Reduce simultaneous voices
    AudioSettings.GetConfiguration().numVirtualVoices = 32;
    AudioSettings.GetConfiguration().numRealVoices = 16;

    // Force compression
    audioImporter.compressionFormat = AudioCompressionFormat.Vorbis;
    audioImporter.quality = 0.5f; // 96 kbps
#endif
```

### Console/PC Settings

```csharp
#if UNITY_STANDALONE || UNITY_PS5 || UNITY_XBOXSERIES
    AudioSettings.GetConfiguration().numVirtualVoices = 256;
    AudioSettings.GetConfiguration().numRealVoices = 128;

    // Higher quality
    audioImporter.compressionFormat = AudioCompressionFormat.Vorbis;
    audioImporter.quality = 0.7f; // 128-192 kbps
#endif
```

## Quick Reference

**Mixing Levels:**
```
Master:  -3 dB peak (headroom for mastering)
Music:   -12 to -6 dB (background)
SFX:     -6 to 0 dB (prominent)
Voice:   -6 to -3 dB (always clear)
Ambient: -18 to -12 dB (subtle)
```

**Voice Limits by Platform:**
```
Mobile:   16-32 simultaneous voices
Console:  64-128 simultaneous voices
PC:       128-256 simultaneous voices
```

**Compression Formats:**
```
Music:   Vorbis 128-192 kbps, STREAM
SFX short: ADPCM, DECOMPRESS_ON_LOAD
SFX long:  Vorbis 128 kbps, STREAM
Voice:   Vorbis 96-128 kbps, STREAM
```

---

**Use this skill**: When implementing game audio, designing sound systems, or debugging audio performance issues.
