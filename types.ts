
export enum Speaker {
  USER = 'user',
  AGENT = 'agent'
}

export interface TranscriptItem {
  id: string;
  speaker: Speaker;
  text: string;
  isPartial?: boolean;
  timestamp: Date;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export interface AudioVisualizerState {
  volume: number; // 0 to 1
}

export interface LeadData {
  contactName: string;
  companyName: string;
  industry: string; // Sector
  companySize: string;
  painPoint: string; // Problema o dolor
  email: string;
  phone: string;
  website?: string; // Opcional
  meetingPreference?: string; // Preferencia de agendamiento
  timestamp: string;
  conversationHistory?: TranscriptItem[];
}
