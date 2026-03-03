---
name: daw-music
description: DAW music composition with MIDI processing, audio synthesis, interactive game music implementation, and seamless loop creation techniques.
---

## MIDI Processing

```python
# Python MIDI generation for procedural music
import mido
from mido import Message, MidiFile, MidiTrack

# Create MIDI file programmatically
def create_combat_music():
    mid = MidiFile()
    track = MidiTrack()
    mid.tracks.append(track)

    # Tempo: 140 BPM
    tempo = mido.bpm2tempo(140)
    track.append(mido.MetaMessage('set_tempo', tempo=tempo))

    # Drums (channel 9)
    kick = 36
    snare = 38
    hihat = 42

    # 4-bar drum loop
    for bar in range(4):
        # Kick on beats 1 and 3
        track.append(Message('note_on', channel=9, note=kick, velocity=100, time=0))
        track.append(Message('note_off', channel=9, note=kick, time=480))  # Quarter note

        # Snare on beats 2 and 4
        track.append(Message('note_on', channel=9, note=snare, velocity=90, time=0))
        track.append(Message('note_off', channel=9, note=snare, time=480))

        # Hi-hat on every 8th note
        for _ in range(8):
            track.append(Message('note_on', channel=9, note=hihat, velocity=60, time=0))
            track.append(Message('note_off', channel=9, note=hihat, time=240))

    mid.save('combat_drums.mid')

# BAD: hardcoded note values
def bad_melody():
    notes = [60, 62, 64, 65, 67]  # What scale is this?

# GOOD: use music theory
def good_melody(root=60, scale_type='minor'):
    scales = {
        'minor': [0, 2, 3, 5, 7, 8, 10],  # Natural minor
        'major': [0, 2, 4, 5, 7, 9, 11],
        'pentatonic': [0, 2, 4, 7, 9]
    }

    intervals = scales[scale_type]
    return [root + interval for interval in intervals]

# Generate tension chord progression
def tension_progression():
    """Cm → Ab → Bb → Cm (dark, tense)"""
    return [
        [60, 63, 67],  # C minor (Cm)
        [56, 60, 63],  # Ab major
        [58, 62, 65],  # Bb major
        [60, 63, 67],  # C minor (resolve)
    ]
```

## Audio Synthesis (C#/Unity)

```csharp
// Generate procedural audio in Unity
public class ProceduralAudioGenerator : MonoBehaviour
{
    private float _phase = 0f;
    private float _frequency = 440f;  // A4
    private int _sampleRate = 44100;

    // Generate sine wave
    void OnAudioFilterRead(float[] data, int channels)
    {
        float increment = _frequency * 2f * Mathf.PI / _sampleRate;

        for (int i = 0; i < data.Length; i += channels)
        {
            _phase += increment;
            float sample = Mathf.Sin(_phase);

            // Apply to all channels
            for (int c = 0; c < channels; c++)
            {
                data[i + c] = sample * 0.1f;  // Volume
            }

            // Keep phase in bounds
            if (_phase > 2f * Mathf.PI)
                _phase -= 2f * Mathf.PI;
        }
    }
}

// Synthesize explosion sound effect
public class ExplosionSynth : MonoBehaviour
{
    public void GenerateExplosion()
    {
        int sampleRate = 44100;
        float duration = 2f;
        int sampleCount = (int)(duration * sampleRate);

        float[] samples = new float[sampleCount];
        System.Random rand = new System.Random();

        for (int i = 0; i < sampleCount; i++)
        {
            float t = (float)i / sampleRate;

            // Noise (explosion body)
            float noise = (float)(rand.NextDouble() * 2.0 - 1.0);

            // Low-frequency rumble
            float rumble = Mathf.Sin(t * 50f * 2f * Mathf.PI) * 0.5f;

            // Exponential decay envelope
            float envelope = Mathf.Exp(-t * 3f);

            samples[i] = (noise * 0.7f + rumble * 0.3f) * envelope;
        }

        // Create AudioClip
        AudioClip clip = AudioClip.Create("Explosion", sampleCount, 1, sampleRate, false);
        clip.SetData(samples, 0);
        GetComponent<AudioSource>().PlayOneShot(clip);
    }
}
```

## Interactive Music Layers (Wwise/FMOD Style)

```csharp
// Layer-based interactive music system
public class InteractiveMusicSystem : MonoBehaviour
{
    [SerializeField] private AudioSource baseLayer;      // Percussion
    [SerializeField] private AudioSource harmonyLayer;   // Pads
    [SerializeField] private AudioSource melodyLayer;    // Lead
    [SerializeField] private AudioSource tensionLayer;   // Dissonance
    [SerializeField] private AudioSource combatLayer;    // Full intensity

    private MusicState _currentState = MusicState.Exploration;

    public enum MusicState
    {
        Exploration,
        Tension,
        Combat,
        Victory
    }

    void Start()
    {
        // Start all layers, control volume
        baseLayer.Play();
        harmonyLayer.Play();
        melodyLayer.Play();
        tensionLayer.Play();
        combatLayer.Play();

        // All layers MUST be same length and BPM
        TransitionTo(MusicState.Exploration);
    }

    public void TransitionTo(MusicState newState)
    {
        StopAllCoroutines();
        StartCoroutine(CrossfadeToState(newState, 2f));
    }

    private IEnumerator CrossfadeToState(MusicState state, float duration)
    {
        float elapsed = 0f;

        // Target volumes for each state
        Dictionary<MusicState, float[]> stateVolumes = new Dictionary<MusicState, float[]>
        {
            { MusicState.Exploration, new float[] { 1f, 0.6f, 0.8f, 0f, 0f } },
            { MusicState.Tension,     new float[] { 1f, 0.4f, 0.5f, 0.7f, 0f } },
            { MusicState.Combat,      new float[] { 1f, 0.3f, 0.6f, 0.8f, 1f } },
            { MusicState.Victory,     new float[] { 0.5f, 1f, 1f, 0f, 0f } }
        };

        float[] targetVolumes = stateVolumes[state];
        AudioSource[] layers = { baseLayer, harmonyLayer, melodyLayer, tensionLayer, combatLayer };
        float[] startVolumes = layers.Select(l => l.volume).ToArray();

        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;

            for (int i = 0; i < layers.Length; i++)
            {
                layers[i].volume = Mathf.Lerp(startVolumes[i], targetVolumes[i], t);
            }

            yield return null;
        }

        _currentState = state;
    }

    // Trigger on game events
    public void OnEnemySpotted() => TransitionTo(MusicState.Tension);
    public void OnCombatStart() => TransitionTo(MusicState.Combat);
    public void OnCombatEnd() => TransitionTo(MusicState.Victory);
    public void OnReturnToExploration() => TransitionTo(MusicState.Exploration);
}
```

## Seamless Loop Creation

```python
# Python script to verify loop seamlessness
import numpy as np
import scipy.io.wavfile as wavfile

def check_loop_seamless(audio_path, loop_start_samples, loop_end_samples):
    """Verify loop has no clicks at loop point."""
    sample_rate, data = wavfile.read(audio_path)

    # Extract samples at loop boundary
    crossfade_length = int(sample_rate * 0.01)  # 10ms crossfade

    loop_end_region = data[loop_end_samples - crossfade_length:loop_end_samples]
    loop_start_region = data[loop_start_samples:loop_start_samples + crossfade_length]

    # Check zero-crossing alignment
    end_zero_crossing = np.where(np.diff(np.sign(loop_end_region)))[0]
    start_zero_crossing = np.where(np.diff(np.sign(loop_start_region)))[0]

    if len(end_zero_crossing) == 0 or len(start_zero_crossing) == 0:
        print("Warning: No zero-crossings found near loop point")
        return False

    # Check amplitude difference
    amplitude_diff = abs(loop_end_region[-1] - loop_start_region[0])
    max_amplitude = max(np.max(np.abs(loop_end_region)), np.max(np.abs(loop_start_region)))

    if amplitude_diff > max_amplitude * 0.1:  # 10% threshold
        print(f"Warning: Large amplitude jump at loop: {amplitude_diff}")
        return False

    print("Loop appears seamless")
    return True

# Apply crossfade to loop point
def apply_loop_crossfade(audio_data, loop_start, loop_end, crossfade_samples):
    """Apply crossfade between loop end and start."""
    # Extract crossfade regions
    fade_out = audio_data[loop_end - crossfade_samples:loop_end].copy()
    fade_in = audio_data[loop_start:loop_start + crossfade_samples].copy()

    # Create crossfade curve (equal power)
    t = np.linspace(0, 1, crossfade_samples)
    fade_out_curve = np.cos(t * np.pi / 2)
    fade_in_curve = np.sin(t * np.pi / 2)

    # Apply crossfade
    crossfaded = (fade_out * fade_out_curve + fade_in * fade_in_curve)

    # Write back
    audio_data[loop_end - crossfade_samples:loop_end] = crossfaded

    return audio_data
```

## Game Audio Integration (Unity)

```csharp
// Dynamic music system with MIDI-like sequencing
public class MusicSequencer : MonoBehaviour
{
    [SerializeField] private AudioClip[] noteSamples;  // C, C#, D, D#, etc.
    [SerializeField] private AudioSource audioSource;

    private double _nextEventTime;
    private int _beatIndex = 0;
    private double _bpm = 120.0;
    private int[] _melody = { 60, 62, 64, 65, 67, 65, 64, 62 };  // MIDI notes

    void Start()
    {
        _nextEventTime = AudioSettings.dspTime + 1.0;  // Start in 1 second
    }

    void Update()
    {
        double currentTime = AudioSettings.dspTime;

        if (currentTime >= _nextEventTime)
        {
            // Play note
            int midiNote = _melody[_beatIndex % _melody.Length];
            PlayMidiNote(midiNote, _nextEventTime);

            // Schedule next beat
            double beatDuration = 60.0 / _bpm;
            _nextEventTime += beatDuration;
            _beatIndex++;
        }
    }

    void PlayMidiNote(int midiNote, double scheduledTime)
    {
        // MIDI note 60 = C4
        int sampleIndex = (midiNote - 60) % 12;  // C=0, C#=1, etc.

        if (sampleIndex >= 0 && sampleIndex < noteSamples.Length)
        {
            audioSource.pitch = Mathf.Pow(2f, (midiNote - 60) / 12f);
            audioSource.PlayScheduled(scheduledTime);
        }
    }
}

// Procedural music variations
public class ProceduralMusicGenerator : MonoBehaviour
{
    public AudioClip GenerateMelody(int bars, float bpm, int[] scale)
    {
        int sampleRate = 44100;
        float beatDuration = 60f / bpm;
        float barDuration = beatDuration * 4f;  // 4/4 time

        int totalSamples = (int)(bars * barDuration * sampleRate);
        float[] samples = new float[totalSamples];

        System.Random rand = new System.Random();
        int sampleIndex = 0;

        for (int bar = 0; bar < bars; bar++)
        {
            for (int beat = 0; beat < 4; beat++)
            {
                // Random note from scale
                int note = scale[rand.Next(scale.Length)];
                float frequency = 440f * Mathf.Pow(2f, (note - 69) / 12f);  // MIDI 69 = A4

                // Generate sine wave for this beat
                int beatSamples = (int)(beatDuration * sampleRate);
                for (int i = 0; i < beatSamples && sampleIndex < totalSamples; i++)
                {
                    float t = (float)i / sampleRate;

                    // Sine wave with ADSR envelope
                    float envelope = GetADSR(t, beatDuration);
                    samples[sampleIndex++] = Mathf.Sin(2f * Mathf.PI * frequency * t) * envelope * 0.3f;
                }
            }
        }

        AudioClip clip = AudioClip.Create("ProceduralMelody", totalSamples, 1, sampleRate, false);
        clip.SetData(samples, 0);
        return clip;
    }

    private float GetADSR(float t, float noteDuration)
    {
        float attack = 0.05f;
        float decay = 0.1f;
        float sustain = 0.7f;
        float release = 0.15f;

        if (t < attack)
            return t / attack;
        else if (t < attack + decay)
            return 1f - ((t - attack) / decay) * (1f - sustain);
        else if (t < noteDuration - release)
            return sustain;
        else
            return sustain * (1f - (t - (noteDuration - release)) / release);
    }
}
```

## Export Workflow

```bash
# Reaper render settings (command-line)
# Export stems for Wwise/FMOD integration

# BAD: single mixed file
reaper -renderproject "combat.rpp" -outfile "combat.wav"

# GOOD: render individual stems
reaper -renderproject "combat.rpp" -stem "Drums" -outfile "combat_drums.wav"
reaper -renderproject "combat.rpp" -stem "Bass" -outfile "combat_bass.wav"
reaper -renderproject "combat.rpp" -stem "Harmony" -outfile "combat_harmony.wav"
reaper -renderproject "combat.rpp" -stem "Melody" -outfile "combat_melody.wav"

# Convert to OGG for Unity (lossy, smaller)
ffmpeg -i combat_drums.wav -c:a libvorbis -q:a 6 combat_drums.ogg
# q:a 6 = ~192 kbps
```

## Loop Metadata (Unity)

```csharp
// Embed loop points in AudioClip metadata
public class LoopedAudioSource : MonoBehaviour
{
    [SerializeField] private AudioClip loopClip;
    [SerializeField] private int loopStartSamples = 0;
    [SerializeField] private int loopEndSamples = 0;

    private AudioSource _source;

    void Start()
    {
        _source = GetComponent<AudioSource>();
        _source.clip = loopClip;
        _source.Play();
    }

    void Update()
    {
        // Manual loop control
        if (_source.timeSamples >= loopEndSamples)
        {
            _source.timeSamples = loopStartSamples;
        }
    }
}

// Better: use AudioClip streaming for intro + loop
public class IntroLoopAudioSource : MonoBehaviour
{
    [SerializeField] private AudioClip intro;
    [SerializeField] private AudioClip loop;

    private AudioSource _source;
    private bool _playingIntro = true;

    void Start()
    {
        _source = GetComponent<AudioSource>();
        _source.clip = intro;
        _source.loop = false;
        _source.Play();
    }

    void Update()
    {
        if (_playingIntro && !_source.isPlaying)
        {
            _source.clip = loop;
            _source.loop = true;
            _source.Play();
            _playingIntro = false;
        }
    }
}
```
