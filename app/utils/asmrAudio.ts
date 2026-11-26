import { Platform } from 'react-native';

class AsmrAudioController {
  private audioCtx: any = null;
  private isPlaying = false;
  private gainNode: any = null;
  private noiseNode: any = null;
  private filterNode: any = null;
  private intervalId: any = null;

  public start(type: 'nature' | 'boiling' | 'milk_pour' | 'pouring') {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    try {
      this.stop();

      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Generate brown/pink noise buffer for liquid / natural textures
      const bufferSize = this.audioCtx.sampleRate * 2;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brownian noise approximation for soft liquid simmer
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      this.noiseNode = this.audioCtx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      // Bandpass filter to sculpt liquid / bubble resonance
      this.filterNode = this.audioCtx.createBiquadFilter();
      if (type === 'boiling') {
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.value = 450;
        this.filterNode.Q.value = 3.0;
      } else if (type === 'milk_pour') {
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 650;
        this.filterNode.Q.value = 1.2;
      } else if (type === 'pouring') {
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.value = 850;
        this.filterNode.Q.value = 2.0;
      } else {
        // Nature / morning breeze
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 320;
        this.filterNode.Q.value = 0.8;
      }

      this.gainNode = this.audioCtx.createGain();
      // Gentle, non-intrusive ambient volume
      this.gainNode.gain.setValueAtTime(0.01, this.audioCtx.currentTime);
      this.gainNode.gain.exponentialRampToValueAtTime(0.22, this.audioCtx.currentTime + 0.5);

      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.noiseNode.start(0);
      this.isPlaying = true;

      // Subtle bubble popping or splashing frequency modulation
      if (type === 'boiling' || type === 'pouring') {
        this.intervalId = setInterval(() => {
          if (!this.filterNode || !this.audioCtx) return;
          const delta = (Math.random() - 0.5) * 120;
          const baseFreq = type === 'boiling' ? 450 : 850;
          this.filterNode.frequency.setValueAtTime(
            Math.max(200, baseFreq + delta),
            this.audioCtx.currentTime
          );
        }, 80);
      }
    } catch {
      // Audio autoplay policy or unavailable WebAudio
    }
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
      } catch {
        // Ignore
      }
    }

    setTimeout(() => {
      if (this.noiseNode) {
        try {
          this.noiseNode.stop();
          this.noiseNode.disconnect();
        } catch {
          // Ignore
        }
        this.noiseNode = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        try {
          this.audioCtx.close();
        } catch {
          // Ignore
        }
        this.audioCtx = null;
      }
      this.isPlaying = false;
    }, 250);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const asmrAudio = new AsmrAudioController();
