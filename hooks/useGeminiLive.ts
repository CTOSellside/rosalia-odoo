
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, LiveSession } from '@google/genai';
import { TranscriptItem, Speaker } from '../types';
import { createBlob, decode, decodeAudioData } from '../utils/audio-utils';
import { saveLeadToFirestore } from '../utils/firebase';

// Definición de la herramienta para estructurar datos
const saveLeadTool: FunctionDeclaration = {
  name: 'saveLead',
  description: 'Guarda la información del cliente potencial (lead) en la base de datos una vez recolectada.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      contactName: { type: Type.STRING, description: "Nombre de la persona de contacto." },
      companyName: { type: Type.STRING, description: "Nombre de la empresa." },
      industry: { type: Type.STRING, description: "Sector industrial de la empresa." },
      companySize: { type: Type.STRING, description: "Tamaño de la empresa (ej. número de empleados)." },
      painPoint: { type: Type.STRING, description: "El problema principal, dolor o necesidad que quieren resolver." },
      email: { type: Type.STRING, description: "Correo electrónico de contacto." },
      phone: { type: Type.STRING, description: "Número de teléfono." },
      website: { type: Type.STRING, description: "Sitio web o red social (opcional)." },
      meetingPreference: { type: Type.STRING, description: "Fecha y hora preferida para la reunión de demostración." }
    },
    required: ['contactName', 'companyName', 'email']
  }
};

const getSystemInstruction = () => {
  const now = new Date();
  const nowString = now.toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'full', timeStyle: 'short' });

  return `
Eres Rosa, una ejecutiva comercial experta de Odoo en Chile.
Tu objetivo es calificar leads siguiendo un flujo de conversación natural y empático.
Hablas español con modismos chilenos suaves y profesionales.

CONTEXTO TEMPORAL:
La fecha y hora actual es: ${nowString}.
Úsala para calcular fechas futuras relativas (ej. "mañana", "el próximo martes").

INSTRUCCIÓN TÉCNICA PRINCIPAL:
1. Al conectar, TOMA LA INICIATIVA y saluda inmediatamente. No esperes al usuario.
2. Tu objetivo final es recolectar la información para llamar a la función 'saveLead'.

FLUJO DE LA CONVERSACIÓN (Sigue este orden pero sé flexible):
1. **Saludo e Identificación**: "¡Hola! Habla Rosa de Odoo, ¿con quién tengo el gusto?"
2. **Empresa y Sector**: Pregunta el nombre de su empresa y a qué se dedican.
3. **Tamaño**: Pregunta número de empleados.
4. **Dolor/Necesidad**: Pregunta qué problema específico quieren resolver.
5. **Datos de Contacto**: Pide correo, teléfono y web.
6. **AGENDAMIENTO (Nuevo)**: Antes de despedirte, ofrece agendar una demo.
   - Pregunta su disponibilidad.
   - Ofrece proactivamente 2 opciones de horario que sean al menos 12 HORAS DESPUÉS de la hora actual (${nowString}).
   - Si aceptan, confirma el horario.

ACCIÓN FINAL:
Una vez tengas los datos y la preferencia de reunión (si la dieron), llama a la herramienta \`saveLead\`.
Cuando la herramienta confirme el guardado, despídete cordialmente.

Reglas de estilo:
- Mantén respuestas cortas.
- Si el usuario se desvía, retoma el flujo con suavidad.
`;
};

export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [volume, setVolume] = useState(0);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Use a ref to hold the active session promise to avoid closure staleness
  const activeSessionRef = useRef<Promise<LiveSession> | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const historyRef = useRef<TranscriptItem[]>([]);
  const currentInputTextRef = useRef("");
  const currentOutputTextRef = useRef("");
  
  // Ref for silence timeout
  const silenceTimerRef = useRef<number | null>(null);

  const disconnect = useCallback(async () => {
    console.log("Disconnecting session...");
    
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (activeSessionRef.current) {
       try { 
         const session = await activeSessionRef.current;
         // @ts-ignore
         if (session.close) session.close(); 
       } catch(e){ 
         console.error("Error closing session:", e); 
       }
       activeSessionRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    
    setIsConnected(false);
    setIsConnecting(false);
    setVolume(0);
  }, []);

  // Helper to reset silence timer
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    // Set timeout for 10 seconds (10000ms)
    silenceTimerRef.current = setTimeout(() => {
      console.log("Silence timeout reached (10s). Disconnecting...");
      disconnect();
    }, 10000);
  }, [disconnect]);

  // Effect to handle window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [disconnect]);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;
    setError(null);
    setIsConnecting(true);
    
    historyRef.current = [];
    currentInputTextRef.current = "";
    currentOutputTextRef.current = "";
    setTranscripts([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      streamRef.current = stream;

      // Start the silence timer immediately upon connection attempt
      resetSilenceTimer();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Ensure timer is running
            resetSilenceTimer();

            const source = inputCtx.createMediaStreamSource(stream);
            inputSourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              const currentVolume = Math.min(rms * 5, 1);
              setVolume(currentVolume); 
              
              // Reset silence timer if user is speaking (volume threshold)
              if (currentVolume > 0.05) {
                resetSilenceTimer();
              }
              
              const pcmBlob = createBlob(inputData);
              
              if (activeSessionRef.current) {
                activeSessionRef.current.then(session => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch(e) {
                    console.error("Error sending audio:", e);
                  }
                });
              }
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Reset silence timer on ANY message from server (interaction is alive)
            resetSilenceTimer();

            let needsUpdate = false;
            
            // 1. Handle Function Calls
            if (message.toolCall) {
                const functionCalls = message.toolCall.functionCalls;
                for (const fc of functionCalls) {
                    if (fc.name === 'saveLead') {
                        const leadDataToSave = {
                          ...(fc.args as any),
                          conversationHistory: historyRef.current
                        };
                        
                        const result = await saveLeadToFirestore(leadDataToSave);
                        
                        if (activeSessionRef.current) {
                          activeSessionRef.current.then(session => {
                              session.sendToolResponse({
                                  functionResponses: [{
                                      id: fc.id,
                                      name: fc.name,
                                      response: { result: result.message, success: result.success }
                                  }]
                              });
                          });
                        }
                    }
                }
            }

            // 2. Handle Transcripts
            if (message.serverContent?.inputTranscription?.text) {
                currentInputTextRef.current += message.serverContent.inputTranscription.text;
                needsUpdate = true;
            }
            
            if (message.serverContent?.outputTranscription?.text) {
                currentOutputTextRef.current += message.serverContent.outputTranscription.text;
                needsUpdate = true;
            }
            
            if (message.serverContent?.turnComplete) {
                if (currentInputTextRef.current.trim()) {
                    historyRef.current.push({
                        id: `user-${Date.now()}`,
                        speaker: Speaker.USER,
                        text: currentInputTextRef.current.trim(),
                        timestamp: new Date()
                    });
                    currentInputTextRef.current = "";
                }
                if (currentOutputTextRef.current.trim()) {
                    historyRef.current.push({
                        id: `agent-${Date.now()}`,
                        speaker: Speaker.AGENT,
                        text: currentOutputTextRef.current.trim(),
                        timestamp: new Date()
                    });
                    currentOutputTextRef.current = "";
                }
                needsUpdate = true;
            }

            if (needsUpdate) {
               const currentItems: TranscriptItem[] = [];
               if (currentInputTextRef.current) {
                   currentItems.push({ id: 'user-curr', speaker: Speaker.USER, text: currentInputTextRef.current, timestamp: new Date() });
               }
               if (currentOutputTextRef.current) {
                   currentItems.push({ id: 'agent-curr', speaker: Speaker.AGENT, text: currentOutputTextRef.current, timestamp: new Date() });
               }
               setTranscripts([...historyRef.current, ...currentItems]);
            }

            // 3. Handle Audio Playback
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio), 
                  ctx, 
                  24000, 
                  1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (e) {
                console.error("Error decoding audio:", e);
              }
            }
            
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              currentOutputTextRef.current = ""; 
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
            console.log("Session closed");
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          },
          onerror: (err) => {
            console.error("Gemini Live Error:", err);
            setError(err.message || "Error de conexión");
            setIsConnected(false);
            setIsConnecting(false);
            disconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          },
          systemInstruction: { parts: [{ text: getSystemInstruction() }] },
          tools: [{ functionDeclarations: [saveLeadTool] }],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        }
      });
      
      activeSessionRef.current = sessionPromise;
      
    } catch (err: any) {
      console.error("Connection failed:", err);
      setError(err.message || "No se pudo conectar");
      setIsConnecting(false);
      setIsConnected(false);
      disconnect();
    }
  }, [isConnected, isConnecting, disconnect, resetSilenceTimer]);

  return { isConnected, isConnecting, error, connect, disconnect, volume, transcripts };
};
