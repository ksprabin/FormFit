import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, blobToBase64 } from '../utils/audioUtils';
import { WorkoutType } from '../types';
import { WORKOUTS } from '../constants';

interface LiveConfig {
  apiKey: string;
  onTranscription: (text: string, role: 'user' | 'model') => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: Error) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private config: LiveConfig;
  private session: any = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private videoInterval: number | null = null;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(config: LiveConfig) {
    this.config = config;
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async connect(workoutType: WorkoutType, videoElement: HTMLVideoElement) {
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Get specific details for the selected workout
    const workoutDef = WORKOUTS[workoutType];
    const tipsList = workoutDef.tips.map(tip => `- ${tip}`).join('\n');

    // Enhanced System Instruction for Precise, Actionable Feedback
    const systemInstruction = `
      You are an elite biomechanics expert and AI fitness coach named "Coach Gemini".
      The user is performing: ${workoutDef.name}.
      
      TARGET FORM & CUES:
      ${tipsList}
      
      YOUR MISSION:
      Analyze the video feed frame-by-frame and provide continuous, high-precision corrections.
      
      FEEDBACK RULES:
      1. **Every Move Matters**: Comment on the eccentric (lowering) and concentric (lifting) phases.
      2. **Be Specific**: Don't just say "Good job". Say "Good depth", "Elbows tucked", "Control the descent".
      3. **Immediate Correction**: If form deviates, correct it instantly (e.g., "Knees pushing in - force them out!", "Don't swing your back").
      4. **Safety First**: If they are doing something dangerous, start with "STOP".
      5. **Concise Display**: Your output is shown on a HUD. Keep it punchy (max 8-10 words).
      
      Do NOT greet. Do NOT ask questions. Simply analyze and coach.
    `;

    const sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: async () => {
          this.config.onConnect();
          // Setup Video Input Stream
          this.startVideoStream(videoElement, sessionPromise);
        },
        onmessage: async (message: LiveServerMessage) => {
          this.handleMessage(message);
        },
        onclose: (e) => {
          this.config.onDisconnect();
        },
        onerror: (e) => {
            this.config.onError(new Error("Session error"));
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: systemInstruction,
        outputAudioTranscription: {},
      }
    });

    this.session = sessionPromise;
  }

  private startVideoStream(videoEl: HTMLVideoElement, sessionPromise: Promise<any>) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Increased FPS for better motion resolution (was 2)
    const FPS = 5; 
    
    this.videoInterval = window.setInterval(() => {
        if (!videoEl || videoEl.paused || videoEl.ended || !ctx) return;
        
        // Scale down for performance/tokens while maintaining aspect ratio
        const scale = 0.5;
        canvas.width = videoEl.videoWidth * scale;
        canvas.height = videoEl.videoHeight * scale;
        
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
            if (blob) {
                const base64 = await blobToBase64(blob);
                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        media: { data: base64, mimeType: 'image/jpeg' }
                    });
                });
            }
        }, 'image/jpeg', 0.6);
    }, 1000 / FPS);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Transcriptions
    if (message.serverContent?.outputTranscription) {
        this.config.onTranscription(message.serverContent.outputTranscription.text, 'model');
    }

    // Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            this.outputAudioContext,
            24000,
            1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = this.outputAudioContext.createGain();
        source.connect(gainNode);
        gainNode.connect(this.outputAudioContext.destination);
        
        source.addEventListener('ended', () => {
            this.sources.delete(source);
        });
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
    }
    
    // Handle Interruption
    if (message.serverContent?.interrupted) {
        this.sources.forEach(src => {
            try { src.stop(); } catch(e) {}
        });
        this.sources.clear();
        this.nextStartTime = 0;
    }
  }

  async disconnect() {
    if (this.session) {
       const s = await this.session;
       // Cleanup logic
    }
    
    if (this.videoInterval) clearInterval(this.videoInterval);
    
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    this.session = null;
  }
}