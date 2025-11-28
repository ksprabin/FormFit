export enum WorkoutType {
  SQUAT = 'Squat',
  PUSHUP = 'Pushup',
  PLANK = 'Plank',
  LUNGE = 'Lunge',
  BICEP_CURL = 'Bicep Curl',
  TRICEP_EXTENSION = 'Tricep Extension'
}

export interface WorkoutDef {
  id: WorkoutType;
  name: string;
  description: string;
  tips: string[];
}

export interface LogMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export interface AudioVisualizerData {
  volume: number;
}