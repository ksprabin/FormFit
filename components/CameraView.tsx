import React, { useEffect, useRef, useState } from 'react';
import { WorkoutType } from '../types';
import { Camera, RefreshCw, MessageSquare, ScanFace, Activity } from 'lucide-react';
import { PoseLandmarker, FilesetResolver, NormalizedLandmark, DrawingUtils } from '@mediapipe/tasks-vision';

interface CameraViewProps {
  workoutType: WorkoutType;
  isActive: boolean;
  onVideoReady: (video: HTMLVideoElement) => void;
  feedback: string | null;
}

// Linear Interpolation for single values
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

// Utility to calculate 2D angle between three points
const calculateAngle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
};

// --- ANATOMICAL VECTOR SHAPES ---
const ANATOMY_PATHS = {
    // Deltoid (Shoulder Cap)
    delt: {
        path: "M-20,-5 Q-26,10 -15,25 L15,25 Q26,10 20,-5 Z",
        height: 30,
        width: 40
    },
    // Upper Arm (Bicep/Tricep)
    upperArm: {
        path: "M-14,0 Q-24,35 -14,60 L14,60 Q24,35 14,0 Z",
        height: 60, 
        width: 28
    },
    // Forearm
    forearm: {
        path: "M-12,0 Q-16,20 -9,45 L9,45 Q16,20 12,0 Z",
        height: 45,
        width: 24
    },
    // Thigh (Quad/Hamstring)
    thigh: {
        path: "M-18,0 Q-28,35 -14,65 L14,65 Q28,35 18,0 Z",
        height: 65,
        width: 36
    },
    // Calf (Shin)
    calf: {
        path: "M-14,0 Q-22,25 -9,60 L9,60 Q22,25 14,0 Z",
        height: 60,
        width: 28
    },
    // Torso (V-Shape)
    torso: {
        path: "M-45,0 L45,0 L35,65 L-35,65 Z", 
        height: 65,
        width: 90
    },
    // Finger/Digit
    digit: {
        path: "M-4,0 L4,0 L2,25 L-2,25 Z",
        height: 25,
        width: 8
    }
};

// Map Workouts to Active Body Segments for Highlighting
const TARGET_SEGMENTS: Record<WorkoutType, string[]> = {
    [WorkoutType.SQUAT]: ['thigh', 'calf', 'torso'],
    [WorkoutType.PUSHUP]: ['upperArm', 'torso'],
    [WorkoutType.LUNGE]: ['thigh', 'calf'],
    [WorkoutType.BICEP_CURL]: ['upperArm'],
    [WorkoutType.TRICEP_EXTENSION]: ['upperArm'],
    [WorkoutType.PLANK]: ['torso', 'upperArm', 'thigh']
};

export const CameraView: React.FC<CameraViewProps> = ({ 
    workoutType, 
    isActive, 
    onVideoReady, 
    feedback
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [error, setError] = useState<string>('');
  const [hasPermission, setHasPermission] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  
  // Tracking Quality State
  const [trackingQuality, setTrackingQuality] = useState<'GOOD' | 'POOR' | 'LOST'>('LOST');
  const [trackingScore, setTrackingScore] = useState<number>(0);
  const [trackingChangeAnim, setTrackingChangeAnim] = useState(false);
  
  // Local Heuristic Feedback State
  const [heuristicFeedback, setHeuristicFeedback] = useState<string | null>(null);
  
  const trackingQualityRef = useRef<'GOOD' | 'POOR' | 'LOST'>('LOST');
  const lastScoreUpdateRef = useRef<number>(0);
  const lastHeuristicUpdateRef = useRef<number>(0);
  
  // Refs for smoothing and persistence
  const prevLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const lastValidLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const lastLandmarksTimeRef = useRef<number>(0);
  const lastMaskTimeRef = useRef<number>(0);
  
  const stabilityScoreRef = useRef<number>(0);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number>();

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }, 
            audio: false 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
              if(videoRef.current) {
                videoRef.current.play();
                onVideoReady(videoRef.current);
              }
          };
          setHasPermission(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please allow permissions.");
      }
    };

    startCamera();

    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
        }
    };
  }, [onVideoReady]);

  // Initialize MediaPipe
  useEffect(() => {
      const initPose = async () => {
          try {
              const vision = await FilesetResolver.forVisionTasks(
                  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
              );
              poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
                  baseOptions: {
                      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                      delegate: "GPU"
                  },
                  runningMode: "VIDEO",
                  numPoses: 1,
                  minPoseDetectionConfidence: 0.5,
                  minTrackingConfidence: 0.5,
                  minPosePresenceConfidence: 0.5,
                  outputSegmentationMasks: true, // Enabled for Exact Shape tracking
              });
              setIsTracking(true);
          } catch (e) {
              console.error("Failed to load pose detection", e);
          }
      };
      initPose();
  }, []);

  useEffect(() => {
    setTrackingChangeAnim(true);
    const t = setTimeout(() => setTrackingChangeAnim(false), 500);
    return () => clearTimeout(t);
  }, [trackingQuality]);

  // Biomechanical Analysis
  const analyzePose = (landmarks: NormalizedLandmark[], workout: WorkoutType, stabilityScore: number): string | null => {
      const isVisible = (lm: NormalizedLandmark) => (lm.visibility ?? 0) > 0.5;
      const leftShoulder = landmarks[11]; const rightShoulder = landmarks[12];
      const leftElbow = landmarks[13]; const rightElbow = landmarks[14];
      const leftWrist = landmarks[15]; const rightWrist = landmarks[16];
      const leftHip = landmarks[23]; const rightHip = landmarks[24];
      const leftKnee = landmarks[25]; const rightKnee = landmarks[26];
      const leftAnkle = landmarks[27]; const rightAnkle = landmarks[28];
      const leftHeel = landmarks[29]; const rightHeel = landmarks[30];

      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      const torsoHeight = Math.abs(((leftShoulder.y + rightShoulder.y) / 2) - ((leftHip.y + rightHip.y) / 2));
      const bodyScale = (shoulderWidth + torsoHeight) / 2;

      if (bodyScale < 0.02) return null; 

      switch (workout) {
          case WorkoutType.SQUAT: {
              const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
              const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);
              if (ankleWidth > bodyScale * 0.2 && kneeWidth < ankleWidth * 0.75) return "Push Knees Out!";
              const Z_THRESHOLD = bodyScale * 0.6; 
              if (leftKnee.z < leftAnkle.z - Z_THRESHOLD || rightKnee.z < rightAnkle.z - Z_THRESHOLD) return "Keep Knees Behind Toes";
              break;
          }
          case WorkoutType.PUSHUP: {
             const SAG_THRESHOLD = bodyScale * 0.3;
             if (leftHip.y > leftShoulder.y + SAG_THRESHOLD && leftHip.y > leftHeel.y + SAG_THRESHOLD) return "Lift Your Hips!";
             break;
          }
          case WorkoutType.LUNGE: {
             if (stabilityScore > 0.003) return "Balance & Control";
             break;
          }
          case WorkoutType.BICEP_CURL: {
              const leftActive = leftWrist.y < leftHip.y && isVisible(leftWrist);
              const rightActive = rightWrist.y < rightHip.y && isVisible(rightWrist);
              if (leftActive) {
                  const elbowDrift = Math.abs(leftElbow.x - leftShoulder.x);
                  if (elbowDrift > shoulderWidth * 0.9) return "Tuck Left Elbow";
                  const angle = calculateAngle(leftShoulder, leftElbow, leftWrist);
                  if (angle > 160 && stabilityScore < 0.001) return "Curl up fully";
              }
              if (rightActive) {
                  const elbowDrift = Math.abs(rightElbow.x - rightShoulder.x);
                  if (elbowDrift > shoulderWidth * 0.9) return "Tuck Right Elbow";
              }
              if (stabilityScore > 0.0025) return "Keep Torso Still";
              break;
          }
          case WorkoutType.PLANK: {
              const hipY = (leftHip.y + rightHip.y) / 2;
              const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
              const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
              const SAG_THRESHOLD = bodyScale * 0.3;
              const PIKE_THRESHOLD = bodyScale * 0.15;
              if (hipY > ankleY + SAG_THRESHOLD) return "Raise Hips!";
              if (hipY < shoulderY - PIKE_THRESHOLD) return "Lower Hips";
              if (stabilityScore > 0.002) return "Hold Steady!";
              break;
          }
          case WorkoutType.TRICEP_EXTENSION: {
              const isLeft = leftElbow.y < rightElbow.y;
              const activeShoulder = isLeft ? leftShoulder : rightShoulder;
              const activeElbow = isLeft ? leftElbow : rightElbow;
              const activeWrist = isLeft ? leftWrist : rightWrist;
              if (!isVisible(activeElbow) || !isVisible(activeWrist)) break;
              const isOverhead = activeElbow.y < activeShoulder.y;
              const elbowFlare = Math.abs(activeElbow.x - activeShoulder.x);
              if (!isOverhead) return "Raise Elbow High";
              if (elbowFlare > shoulderWidth * 1.4) return "Elbow closer to ear";
              const angle = calculateAngle(activeShoulder, activeElbow, activeWrist);
              if (stabilityScore < 0.001) {
                  if (angle > 70 && angle < 140) return "Full Range needed";
                  if (angle < 60) return "Extend Up";
                  if (angle > 150) return "Lower Behind Head";
              }
              break;
          }
      }
      return null;
  };

  const detectPose = async () => {
      if (
          poseLandmarkerRef.current && 
          videoRef.current && 
          videoRef.current.readyState >= 2 &&
          containerRef.current && 
          canvasRef.current
      ) {
          const startTimeMs = performance.now();
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;

          if (videoWidth === 0 || videoHeight === 0 || containerWidth === 0 || containerHeight === 0) {
               requestRef.current = requestAnimationFrame(detectPose);
               return;
          }

          if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
              canvas.width = containerWidth;
              canvas.height = containerHeight;
          }

          // Initialize Temp Canvas for Mask Processing (Video Size)
          if (!tempCanvasRef.current) {
              tempCanvasRef.current = document.createElement('canvas');
          }
          const tempCanvas = tempCanvasRef.current;
          if (tempCanvas.width !== videoWidth || tempCanvas.height !== videoHeight) {
              tempCanvas.width = videoWidth;
              tempCanvas.height = videoHeight;
          }
          
          // Initialize Raw Mask Canvas (Mask Size)
          if (!maskCanvasRef.current) {
              maskCanvasRef.current = document.createElement('canvas');
          }

          if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              let currentQuality: 'GOOD' | 'POOR' | 'LOST' = 'LOST';
              let currentScore = 0;
              let segmentationMask: any = null;
              let landmarks: NormalizedLandmark[] | null = null;
              const now = Date.now();

              try {
                  const results = poseLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
                  
                  // --- MASK PERSISTENCE LOGIC ---
                  if (results.segmentationMasks && results.segmentationMasks.length > 0) {
                      segmentationMask = results.segmentationMasks[0];
                      lastMaskTimeRef.current = now;
                  }
                  
                  // --- LANDMARK PERSISTENCE LOGIC ---
                  if (results.landmarks && results.landmarks.length > 0) {
                      landmarks = results.landmarks[0];
                      lastValidLandmarksRef.current = landmarks;
                      lastLandmarksTimeRef.current = now;
                  } else {
                      // Grace period: Use last known landmarks if < 200ms
                      if (lastValidLandmarksRef.current && (now - lastLandmarksTimeRef.current < 200)) {
                          landmarks = lastValidLandmarksRef.current;
                      }
                  }
                  
                  const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
                  const renderedWidth = videoWidth * scale;
                  const renderedHeight = videoHeight * scale;
                  const offsetX = (renderedWidth - containerWidth) / 2;
                  const offsetY = (renderedHeight - containerHeight) / 2;

                  // 1. Process Segmentation Mask (if available)
                  let maskDrawn = false;
                  if (segmentationMask && typeof segmentationMask.getAsFloat32Array === 'function' && maskCanvasRef.current) {
                      const rawData = segmentationMask.getAsFloat32Array();
                      const width = segmentationMask.width;
                      const height = segmentationMask.height;
                      
                      const maskCanvas = maskCanvasRef.current;
                      if (maskCanvas.width !== width || maskCanvas.height !== height) {
                          maskCanvas.width = width;
                          maskCanvas.height = height;
                      }
                      
                      const maskCtx = maskCanvas.getContext('2d');
                      if (maskCtx) {
                          const imgData = maskCtx.createImageData(width, height);
                          const data = imgData.data;
                          
                          for (let i = 0; i < rawData.length; i++) {
                              const val = rawData[i];
                              const alpha = val > 0.05 ? 255 : 0; 
                              const pixelIdx = i * 4;
                              // Use Green Base for Mask (Emerald-500: #10b981)
                              // R: 16, G: 185, B: 129
                              data[pixelIdx] = 16;     // R
                              data[pixelIdx + 1] = 185; // G
                              data[pixelIdx + 2] = 129; // B
                              data[pixelIdx + 3] = alpha; 
                          }
                          maskCtx.putImageData(imgData, 0, 0);
                          maskDrawn = true;
                      }
                  } else if (maskCanvasRef.current && (now - lastMaskTimeRef.current < 200)) {
                      maskDrawn = true; 
                  }

                  // 2. Draw Mask to Main Canvas (if available)
                  ctx.save();
                  if (maskDrawn && maskCanvasRef.current) {
                      const tempCtx = tempCanvas.getContext('2d');
                      if (tempCtx) {
                          tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                          tempCtx.drawImage(maskCanvasRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
                          
                          // Add Glow to the mask (Green)
                          ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
                          ctx.shadowBlur = 20;

                          ctx.globalAlpha = 1.0; 
                          ctx.drawImage(
                              tempCanvas, 
                              0, 0, tempCanvas.width, tempCanvas.height, 
                              -offsetX, -offsetY, renderedWidth, renderedHeight
                          );
                          
                          // Disable glow for inner fill
                          ctx.shadowBlur = 0;

                          // Fill body base (Stronger opacity for visibility)
                          // Source-in keeps the fill strictly inside the mask
                          ctx.globalCompositeOperation = 'source-in';
                          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)'; // Emerald Green
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                      }
                  }
                  
                  // 3. Draw Anatomy (Always draw if landmarks exist)
                  // Use 'source-over' but we actually want to paint INSIDE the mask if it exists.
                  // Since we just did source-in for the fill, the canvas only has pixels where the body is.
                  // If we use 'source-atop', we can paint muscles ON TOP of the green body but clipped to it.
                  // If mask isn't drawn, we just draw normal source-over.
                  if (maskDrawn) {
                      ctx.globalCompositeOperation = 'source-atop';
                  } else {
                      ctx.globalCompositeOperation = 'source-over';
                  }

                  if (landmarks) {
                      const smoothedLandmarks = adaptiveSmoothLandmarks(landmarks, prevLandmarksRef.current);
                      
                      const drawMusclePart = (startIdx: number, endIdx: number, partKey: keyof typeof ANATOMY_PATHS) => {
                          const start = smoothedLandmarks[startIdx];
                          const end = smoothedLandmarks[endIdx];
                          const def = ANATOMY_PATHS[partKey];

                          if (!start || !end) return;
                          
                          const avgVis = ((start.visibility ?? 0) + (end.visibility ?? 0)) / 2;
                          // Lower visibility threshold so occluded parts are drawn (faintly)
                          const alpha = avgVis < 0.3 ? 0.3 : 0.6; 

                          const startX = start.x * renderedWidth - offsetX;
                          const startY = start.y * renderedHeight - offsetY;
                          const endX = end.x * renderedWidth - offsetX;
                          const endY = end.y * renderedHeight - offsetY;

                          const dx = endX - startX;
                          const dy = endY - startY;
                          const len = Math.hypot(dx, dy);
                          const angle = Math.atan2(dy, dx) - Math.PI / 2;

                          // Check if this part is a target muscle for current workout
                          const targets = TARGET_SEGMENTS[workoutType] || [];
                          const isTarget = targets.includes(partKey);

                          ctx.save();
                          ctx.translate(startX, startY);
                          ctx.rotate(angle);
                          
                          const scaleY = len / def.height;
                          // Overscale width slightly (1.5x) so it fills the mask edge-to-edge
                          // The 'source-atop' or 'source-in' clipping will trim the excess, resulting in exact body match.
                          const scaleX = scaleY * 1.5; 

                          ctx.scale(scaleX, scaleY);

                          const p = new Path2D(def.path);
                          // Active muscles get Hot Orange/Red, others get slightly lighter Green
                          ctx.fillStyle = isTarget 
                              ? `rgba(251, 146, 60, ${alpha})` // Orange-400
                              : `rgba(52, 211, 153, ${alpha})`; // Emerald-400
                              
                          ctx.fill(p);
                          ctx.restore();
                      };

                      // Draw Muscles (Internal Texture)
                      // Only draw active muscles or base structure
                      
                      // Torso needs special handling for orientation
                      const midShoulderX = (smoothedLandmarks[11].x + smoothedLandmarks[12].x) / 2;
                      const midShoulderY = (smoothedLandmarks[11].y + smoothedLandmarks[12].y) / 2;
                      const midHipX = (smoothedLandmarks[23].x + smoothedLandmarks[24].x) / 2;
                      const midHipY = (smoothedLandmarks[23].y + smoothedLandmarks[24].y) / 2;
                      const torsoStart = { x: midShoulderX, y: midShoulderY };
                      const torsoEnd = { x: midHipX, y: midHipY };
                      
                      const drawTorso = () => {
                          const startX = torsoStart.x * renderedWidth - offsetX;
                          const startY = torsoStart.y * renderedHeight - offsetY;
                          const endX = torsoEnd.x * renderedWidth - offsetX;
                          const endY = torsoEnd.y * renderedHeight - offsetY;
                          const dx = endX - startX;
                          const dy = endY - startY;
                          const len = Math.hypot(dx, dy);
                          const angle = Math.atan2(dy, dx) - Math.PI / 2;
                          
                          const isTarget = TARGET_SEGMENTS[workoutType]?.includes('torso');
                          
                          ctx.save();
                          ctx.translate(startX, startY);
                          ctx.rotate(angle);
                          const scaleY = len / ANATOMY_PATHS.torso.height;
                          const scaleX = scaleY * 1.5; 
                          ctx.scale(scaleX, scaleY);
                          
                          ctx.fillStyle = isTarget 
                              ? 'rgba(251, 146, 60, 0.5)' 
                              : 'rgba(52, 211, 153, 0.4)';
                              
                          ctx.fill(new Path2D(ANATOMY_PATHS.torso.path));
                          ctx.restore();
                      };
                      drawTorso();

                      drawMusclePart(11, 13, 'upperArm'); 
                      drawMusclePart(12, 14, 'upperArm'); 
                      drawMusclePart(13, 15, 'forearm'); 
                      drawMusclePart(14, 16, 'forearm'); 
                      drawMusclePart(23, 25, 'thigh'); 
                      drawMusclePart(24, 26, 'thigh'); 
                      drawMusclePart(25, 27, 'calf'); 
                      drawMusclePart(26, 28, 'calf'); 
                      
                      // Fingers (Digits) - usually not targeted, keep base green
                      drawMusclePart(15, 19, 'digit'); 
                      drawMusclePart(15, 17, 'digit'); 
                      drawMusclePart(16, 20, 'digit'); 
                      drawMusclePart(16, 18, 'digit'); 

                      // Weld Joints - Keep consistent Green/Emerald
                      const drawJointWeld = (idx: number, sizeFactor: number = 1.0) => {
                          const lm = smoothedLandmarks[idx];
                          if (!lm || (lm.visibility ?? 0) < 0.1) return;
                          
                          const x = lm.x * renderedWidth - offsetX;
                          const y = lm.y * renderedHeight - offsetY;
                          
                          const widthRef = Math.abs(smoothedLandmarks[11].x - smoothedLandmarks[12].x) * renderedWidth * 0.15; 
                          const radius = widthRef * sizeFactor * 1.3; 
                          
                          ctx.beginPath();
                          ctx.arc(x, y, radius, 0, 2 * Math.PI);
                          ctx.fillStyle = `rgba(16, 185, 129, 0.7)`; // Emerald
                          ctx.fill();
                      };

                      drawJointWeld(11); // L Shoulder
                      drawJointWeld(12); // R Shoulder
                      drawJointWeld(13); // L Elbow
                      drawJointWeld(14); // R Elbow
                      drawJointWeld(23); // L Hip
                      drawJointWeld(24); // R Hip
                      drawJointWeld(25); // L Knee
                      drawJointWeld(26); // R Knee
                      drawJointWeld(15, 0.8); // L Wrist
                      drawJointWeld(16, 0.8); // R Wrist

                      // Update Tracking Quality
                      let totalVis = 0;
                      let count = 0;
                      for (let i = 11; i <= 22; i++) {
                          if (smoothedLandmarks[i]) {
                              totalVis += (smoothedLandmarks[i].visibility ?? 0);
                              count++;
                          }
                      }
                      currentScore = count > 0 ? totalVis / count : 0;
                      const sWidth = Math.abs(smoothedLandmarks[11].x - smoothedLandmarks[12].x);
                      if (sWidth < 0.05) currentScore *= 0.5;

                      if (currentScore > 0.8) currentQuality = 'GOOD';
                      else if (currentScore > 0.5) currentQuality = 'POOR';
                      else currentQuality = 'LOST';
                      
                      prevLandmarksRef.current = smoothedLandmarks;
                  }

                  // Restore context logic
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.restore();

                  // ... heuristics logic ...
                  if (landmarks) {
                     if (prevLandmarksRef.current) {
                          const currentHips = { 
                              x: (landmarks[23].x + landmarks[24].x)/2, 
                              y: (landmarks[23].y + landmarks[24].y)/2 
                          };
                          const prevHips = { 
                              x: (prevLandmarksRef.current[23].x + prevLandmarksRef.current[24].x)/2, 
                              y: (prevLandmarksRef.current[23].y + prevLandmarksRef.current[24].y)/2 
                          };
                          const movement = Math.hypot(currentHips.x - prevHips.x, currentHips.y - prevHips.y);
                          stabilityScoreRef.current = (stabilityScoreRef.current * 0.9) + (movement * 0.1);
                      }
                      
                      const now = Date.now();
                      if (isActive && now - lastHeuristicUpdateRef.current > 500) { 
                          const localCue = analyzePose(landmarks, workoutType, stabilityScoreRef.current);
                          setHeuristicFeedback(localCue);
                          lastHeuristicUpdateRef.current = now;
                      }
                  } else {
                      if (now - lastLandmarksTimeRef.current > 200) {
                          currentQuality = 'LOST';
                          currentScore = 0;
                          prevLandmarksRef.current = null;
                      }
                  }
                  
                  if (segmentationMask && typeof segmentationMask.close === 'function') {
                      segmentationMask.close();
                  }

              } catch (e) {
                  console.error(e);
                  if (segmentationMask && typeof segmentationMask.close === 'function') segmentationMask.close();
              }

              const currentTime = Date.now();
              if (currentQuality !== trackingQualityRef.current || Math.abs(currentScore - trackingScore) > 0.1 || currentTime - lastScoreUpdateRef.current > 100) {
                  trackingQualityRef.current = currentQuality;
                  setTrackingQuality(currentQuality);
                  setTrackingScore(currentScore);
                  lastScoreUpdateRef.current = currentTime;
              }
          }
      }
      requestRef.current = requestAnimationFrame(detectPose);
  };

  const adaptiveSmoothLandmarks = (
      current: NormalizedLandmark[], 
      prev: NormalizedLandmark[] | null
  ): NormalizedLandmark[] => {
      if (!prev) return current;

      const coreIndices = [11, 12, 23, 24]; // Shoulders and Hips
      let totalCoreMovement = 0;
      let count = 0;
      
      coreIndices.forEach(idx => {
          if (current[idx] && prev[idx]) {
             totalCoreMovement += Math.hypot(current[idx].x - prev[idx].x, current[idx].y - prev[idx].y);
             count++;
          }
      });
      const globalVelocity = count > 0 ? totalCoreMovement / count : 0;

      return current.map((curr, i) => {
          const p = prev[i];
          const localVelocity = Math.hypot(curr.x - p.x, curr.y - p.y);
          // Hybrid Velocity: Use max of local movement or global body movement (scaled down)
          const metric = Math.max(localVelocity, globalVelocity * 0.6);

          const minAlpha = 0.08; 
          const maxAlpha = 0.92; 
          
          const lowerThreshold = 0.0005;
          const upperThreshold = 0.025; 
          
          let alpha = minAlpha;
          
          if (metric > lowerThreshold) {
              // Cubic Ease-Out for snappier response
              const t = Math.min(1, (metric - lowerThreshold) / (upperThreshold - lowerThreshold));
              const curve = 1 - Math.pow(1 - t, 3);
              alpha = minAlpha + (maxAlpha - minAlpha) * curve;
          }

          return {
              x: lerp(p.x, curr.x, alpha),
              y: lerp(p.y, curr.y, alpha),
              z: lerp(p.z, curr.z, alpha),
              visibility: curr.visibility
          };
      });
  };

  useEffect(() => {
      if (isTracking && hasPermission) {
          requestRef.current = requestAnimationFrame(detectPose);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [isTracking, hasPermission, workoutType]);

  const activeFeedback = feedback || heuristicFeedback;
  const isHeuristic = !feedback && !!heuristicFeedback;

  const getQualityColor = () => {
    switch (trackingQuality) {
        case 'GOOD': return { 
            text: 'text-cyan-400', 
            ring: 'ring-cyan-500/50',
            stroke: 'text-cyan-500', 
            shadow: 'drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]'
        };
        case 'POOR': return { 
            text: 'text-amber-400', 
            ring: 'ring-amber-500/50',
            stroke: 'text-amber-500', 
            shadow: 'drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]'
        };
        default: return { 
            text: 'text-red-400', 
            ring: 'ring-red-500/50',
            stroke: 'text-red-500', 
            shadow: 'drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]'
        };
    }
  };
  
  const colors = getQualityColor();

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
        {!hasPermission && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
        )}
        
        {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-slate-900 z-50 p-4 text-center">
                <Camera className="w-8 h-8 mb-2" />
                <p>{error}</p>
            </div>
        )}

      <video
        ref={videoRef}
        className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${hasPermission ? 'opacity-100' : 'opacity-0'}`}
        playsInline
        muted
      />

      <canvas 
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-10 w-full h-full transform scale-x-[-1]"
      />
      
      {isTracking && (
          <div className="absolute top-4 right-4 z-20 group">
              <div className={`
                  bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 flex items-center justify-center relative shadow-lg shadow-black/20
                  transition-all duration-300 transform 
                  ${trackingChangeAnim ? `scale-110 ring-4 ${colors.ring} bg-black/60` : 'scale-100'}
              `}>
                  <div className={`relative w-12 h-12 flex items-center justify-center transition-all duration-300 ${trackingChangeAnim ? colors.shadow : ''}`}>
                       <svg className="absolute w-full h-full transform -rotate-90">
                           <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                       </svg>
                       <svg className={`absolute w-full h-full transform -rotate-90 transition-colors duration-300 ${colors.stroke}`}>
                           <circle 
                                cx="24" cy="24" r="20" 
                                stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"
                                strokeDasharray="125.6" 
                                strokeDashoffset={125.6 - (trackingScore * 125.6)}
                                className="transition-[stroke-dashoffset] duration-300 ease-out"
                           />
                       </svg>
                       
                       <div className="absolute inset-0 flex items-center justify-center flex-col">
                           {trackingQuality === 'GOOD' ? (
                               <ScanFace size={20} className={colors.text} />
                           ) : (
                               <span className={`text-[10px] font-bold font-mono ${colors.text}`}>
                                   {(trackingScore * 100).toFixed(0)}%
                               </span>
                           )}
                       </div>
                  </div>
              </div>
          </div>
      )}
      
      {activeFeedback && (
          <div className="absolute bottom-6 left-6 right-6 z-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className={`
                  backdrop-blur-xl border p-4 rounded-2xl shadow-2xl flex items-start gap-3
                  ${isHeuristic ? 'bg-indigo-900/80 border-indigo-500/30' : 'bg-black/70 border-cyan-500/30'}
              `}>
                  <div className={`p-2 rounded-full mt-1 ${isHeuristic ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {isHeuristic ? <Activity size={24} /> : <MessageSquare size={24} />}
                  </div>
                  <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isHeuristic ? 'text-indigo-400' : 'text-cyan-400'}`}>
                          {isHeuristic ? 'Form Correction' : 'Coach Gemini'}
                      </h4>
                      <p className="text-white text-xl font-bold leading-tight drop-shadow-md">
                        {activeFeedback}
                      </p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};