import React from 'react';
import { WorkoutType, WorkoutDef } from './types';

export const WORKOUTS: Record<WorkoutType, WorkoutDef> = {
  [WorkoutType.SQUAT]: {
    id: WorkoutType.SQUAT,
    name: 'Bodyweight Squat',
    description: 'Keep feet shoulder-width apart, keep back straight, lower until thighs are parallel.',
    tips: ['Keep chest up', 'Weight on heels', 'Knees tracking over toes']
  },
  [WorkoutType.PUSHUP]: {
    id: WorkoutType.PUSHUP,
    name: 'Push Up',
    description: 'Hands shoulder-width, body in a straight line, lower chest to floor.',
    tips: ['Core tight', 'Elbows at 45 degrees', 'Full range of motion']
  },
  [WorkoutType.PLANK]: {
    id: WorkoutType.PLANK,
    name: 'Plank',
    description: 'Hold a straight body position supporting weight on forearms and toes.',
    tips: ['Don\'t let hips sag', 'Keep neck neutral', 'Squeeze glutes']
  },
  [WorkoutType.LUNGE]: {
    id: WorkoutType.LUNGE,
    name: 'Forward Lunge',
    description: 'Step forward with one leg, lower hips until both knees are bent at 90 degrees.',
    tips: ['Keep torso upright', 'Don\'t let knee pass toe', 'Push back to start']
  },
  [WorkoutType.BICEP_CURL]: {
    id: WorkoutType.BICEP_CURL,
    name: 'Bicep Curl',
    description: 'Stand straight with dumbbells, curl weights towards shoulders.',
    tips: ['Elbows tucked in', 'Control the descent', 'No swinging']
  },
  [WorkoutType.TRICEP_EXTENSION]: {
    id: WorkoutType.TRICEP_EXTENSION,
    name: 'Single Arm Overhead Tricep Extension',
    description: 'Hold weight overhead, lower behind head by bending elbow, then extend back up.',
    tips: ['Keep elbow close to ear', 'Only move forearm', 'Full extension at top']
  }
};
