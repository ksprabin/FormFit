import React, { useState, useEffect } from 'react';
import { WorkoutType } from '../types';

interface Props {
  workoutType: WorkoutType;
}

type ViewAngle = 'FRONT' | 'SIDE' | 'BACK';

export const ReferenceVisualizer: React.FC<Props> = ({ workoutType }) => {
  const [view, setView] = useState<ViewAngle>('FRONT');

  // Cycle views every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setView(prev => {
          if (prev === 'FRONT') return 'SIDE';
          if (prev === 'SIDE') return 'BACK';
          return 'FRONT';
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- CONFIG ---
  const colorNear = "#10b981"; // Emerald-500 (Base Muscle)
  const colorFar = "#064e3b";  // Emerald-900
  const colorSkin = "#34d399"; // Emerald-400
  const colorHair = "#065f46"; // Emerald-800
  const colorWeight = "#64748b"; // Slate-500
  const colorDetail = "#047857"; // Emerald-700

  // Target Muscles Config
  const TARGET_MUSCLES: Record<WorkoutType, string[]> = {
      [WorkoutType.SQUAT]: ['quads', 'glutes', 'hamstrings'],
      [WorkoutType.PUSHUP]: ['pecs', 'triceps', 'delts'],
      [WorkoutType.LUNGE]: ['quads', 'glutes', 'hamstrings', 'calves'],
      [WorkoutType.BICEP_CURL]: ['biceps'],
      [WorkoutType.TRICEP_EXTENSION]: ['triceps'],
      [WorkoutType.PLANK]: ['abs', 'delts', 'quads']
  };

  const activeTargets = TARGET_MUSCLES[workoutType] || [];

  // --- MUSCULAR ANATOMY PATHS (Based on Anatomy Chart) ---
  const paths = {
      head: "M0,-24 C13,-24 24,-14 24,0 C24,16 14,28 0,28 C-14,28 -24,16 -24,0 C-24,-14 -13,-24 0,-24",
      
      // Muscular V-Taper Torso
      torsoBase: "M-50,-65 L50,-65 L35,0 L28,45 L-28,45 L-35,0 Z",
      
      // Anatomy Details (Pecs, Abs, Center Line)
      torsoDetail: "M-50,-45 Q0,-25 50,-45 M0,-60 L0,35 M-25,-10 L25,-10 M-22,15 L22,15",

      // Pectorals (Chest Plates) for highlighting
      pecs: "M-50,-65 Q0,-45 50,-65 L40,-30 Q0,-10 -40,-30 Z",
      // Abs (6-Pack Block)
      abs: "M-22,-10 L22,-10 L20,35 L-20,35 Z",
      
      // Deltoid (Large Shoulder Cap)
      delt: "M-22,-5 Q-28,15 -18,30 L18,30 Q28,15 22,-5 Z",
      
      // Upper Arm (Thick Bicep/Tricep)
      bicep: "M-16,25 Q-26,45 -12,65 L12,65 Q26,45 16,25 Z",
      tricep: "M-16,25 Q-28,45 -16,60 L16,60 Q28,45 16,25 Z",
      
      // Forearm (Muscular Taper)
      forearm: "M-14,0 Q-20,20 -10,45 L10,45 Q20,20 14,0 Z",
      
      // Thigh Base (Quad Sweep)
      thigh: "M-22,0 L22,0 L18,75 L-18,75 Z",
      quad: "M-22,0 Q-35,35 -18,70 L18,70 Q35,35 22,0 Z",
      hamstring: "M-22,10 Q-32,40 -18,75 L18,75 Q32,40 22,10 Z",
      glutes: "M-22,-10 Q-35,20 -18,45 L18,45 Q35,20 22,-10 Z",
      
      // Calf (Diamond Shape)
      calf: "M-16,0 Q-26,25 -10,65 L10,65 Q26,25 16,0 Z",
      shin: "M-16,0 L16,0 L12,80 L-12,80 Z",
      
      foot: "M-12,0 L12,0 L12,20 C12,26 -12,26 -12,20 Z"
  };

  const VIEWBOX = "-130 -200 260 550"; 

  // Helper Components
  const Joint = ({ r = 16, fill, transform }: { r?: number, fill: string, transform?: string }) => (
      <circle cx="0" cy="0" r={r} fill={fill} transform={transform} />
  );

  const Muscle = ({ d, name, fill, side = false }: { d: string, name: string, fill: string, side?: boolean }) => {
      const isActive = activeTargets.includes(name);
      
      // 'muscle-pulse-dynamic' transitions from orange to red peak
      const style: React.CSSProperties = isActive ? { 
          animation: 'muscle-pulse-dynamic 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          transformOrigin: 'center',
      } : { fill: fill };

      return (
        <path 
            d={d} 
            stroke={side ? "none" : "rgba(0,0,0,0.15)"} 
            strokeWidth="1" 
            strokeLinejoin="round" 
            fill={isActive ? '#fb923c' : fill} 
            style={style} 
        />
      );
  };

  // Complex Body Parts
  const TorsoGroup = ({ fill, detailColor }: { fill: string, detailColor: string }) => (
      <g>
          <path d={paths.torsoBase} fill={fill} strokeLinejoin="round" />
          {/* Anatomy Lines */}
          <path d={paths.torsoDetail} fill="none" stroke={detailColor} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <Muscle d={paths.pecs} name="pecs" fill={detailColor} />
          <Muscle d={paths.abs} name="abs" fill={detailColor} />
      </g>
  );

  const ArmGroup = ({ fill }: { fill: string }) => (
      <g>
          <Muscle d={paths.delt} name="delts" fill={fill} />
          <g transform="translate(0, 0)">
             <Muscle d={paths.bicep} name="biceps" fill={fill} /> 
             <Muscle d={paths.tricep} name="triceps" fill={fill} side />
          </g>
      </g>
  );
  
  const LegGroup = ({ fill, isBack = false }: { fill: string, isBack?: boolean }) => (
      <g>
          {isBack && <Muscle d={paths.glutes} name="glutes" fill={fill} />}
          {isBack ? <Muscle d={paths.hamstring} name="hamstrings" fill={fill} /> : <Muscle d={paths.quad} name="quads" fill={fill} />}
      </g>
  );

  // --- RENDERERS ---

  const renderSquat = (isSide: boolean, isBack: boolean) => {
      if (isSide) {
          return (
              <g transform="translate(0, 100)">
                  {/* Far Leg */}
                  <g transform="translate(8, -8)">
                      <g style={{ animation: 'vector-squat-thigh-side 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                          <LegGroup fill={colorFar} isBack={false} />
                          <Joint fill={colorFar} r={16} />
                          <g transform="translate(0, 75)">
                              <g style={{ animation: 'vector-squat-shin-side 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                  <Muscle d={paths.calf} name="calves" fill={colorFar} />
                                  <Joint fill={colorFar} r={14} />
                              </g>
                          </g>
                      </g>
                  </g>
                  
                  {/* Far Arm */}
                  <g style={{ animation: 'vector-squat-hips-side 3s ease-in-out infinite' }}>
                      <g transform="translate(15, -95) rotate(30)">
                          <ArmGroup fill={colorFar} />
                          <Joint fill={colorFar} r={14} />
                          <g transform="translate(0, 55) rotate(-10)">
                              <path d={paths.forearm} fill={colorFar} />
                              <Joint fill={colorFar} r={12} />
                          </g>
                      </g>
                  </g>

                  {/* Near Body */}
                  <g style={{ animation: 'vector-squat-hips-side 3s ease-in-out infinite' }}>
                      <g style={{ animation: 'vector-squat-torso-side 3s ease-in-out infinite', transformOrigin: '0 50' }}>
                          <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                          <path d={paths.head} fill={colorSkin} transform="translate(0, -175)" />
                          
                          {/* Near Arm */}
                          <g transform="translate(0, -145) rotate(30)">
                              <ArmGroup fill={colorNear} />
                              <Joint fill={colorNear} r={16} />
                              <g transform="translate(0, 55) rotate(-10)">
                                  <path d={paths.forearm} fill={colorNear} />
                                  <Joint fill={colorNear} r={14} />
                              </g>
                          </g>
                      </g>
                  </g>

                  {/* Near Leg */}
                  <g transform="translate(-8, 8)">
                      <g style={{ animation: 'vector-squat-thigh-side 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                          <LegGroup fill={colorNear} isBack={false} />
                          <Joint fill={colorNear} r={20} />
                          <g transform="translate(0, 75)">
                              <g style={{ animation: 'vector-squat-shin-side 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                  <Muscle d={paths.calf} name="calves" fill={colorNear} />
                                  <Joint fill={colorNear} r={14} />
                              </g>
                          </g>
                      </g>
                  </g>
              </g>
          );
      }
      
      return (
        <g transform="translate(0, 100)">
            <g style={{ animation: 'vector-squat-hips-front 3s ease-in-out infinite' }}>
                <g transform="translate(-25, 0)">
                    <g style={{ animation: 'vector-squat-thigh-right 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                        <LegGroup fill={colorNear} isBack={isBack} />
                        <Joint fill={colorNear} r={20} />
                        <g transform="translate(0, 75)">
                            <g style={{ animation: 'vector-squat-shin-right 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                               <Muscle d={paths.shin} name="calves" fill={colorNear} />
                               <Joint fill={colorNear} r={14} />
                            </g>
                        </g>
                    </g>
                </g>
                <g transform="translate(25, 0)">
                    <g style={{ animation: 'vector-squat-thigh-left 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                        <LegGroup fill={colorNear} isBack={isBack} />
                        <Joint fill={colorNear} r={20} />
                        <g transform="translate(0, 75)">
                            <g style={{ animation: 'vector-squat-shin-left 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                               <Muscle d={paths.shin} name="calves" fill={colorNear} />
                               <Joint fill={colorNear} r={14} />
                            </g>
                        </g>
                    </g>
                </g>
                
                <g transform="translate(0, -100)">
                    <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                </g>
                
                <path d={paths.head} fill={isBack ? colorHair : colorSkin} transform="translate(0, -175)" />

                <g transform="translate(-48, -145) rotate(15)">
                    <ArmGroup fill={colorNear} />
                    <Joint fill={colorNear} r={16} />
                    <g transform="translate(0, 55) rotate(15)">
                         <path d={paths.forearm} fill={colorNear} />
                         <Joint fill={colorNear} r={14} />
                    </g>
                </g>
                
                <g transform="translate(48, -145) rotate(-15)">
                    <ArmGroup fill={colorNear} />
                    <Joint fill={colorNear} r={16} />
                    <g transform="translate(0, 55) rotate(-15)">
                         <path d={paths.forearm} fill={colorNear} />
                         <Joint fill={colorNear} r={14} />
                    </g>
                </g>
            </g>
        </g>
      );
  };

  const renderPushup = (isSide: boolean) => {
      if (isSide) {
          return (
              <g transform="translate(-50, 150) scale(0.85)">
                  <line x1="-150" y1="50" x2="250" y2="50" stroke="#334155" strokeWidth="4" />
                  <g style={{ animation: 'vector-pushup-body 3s ease-in-out infinite', transformOrigin: '150 50' }}>
                      <g transform="translate(150, 50) rotate(60)">
                           <path d={paths.foot} fill={colorFar} />
                      </g>
                      <g transform="translate(0, 50)">
                            <g style={{ animation: 'vector-pushup-forearm 3s ease-in-out infinite', transformOrigin: '0 0' }} transform="translate(0, -50)">
                               <path d={paths.forearm} fill={colorFar} />
                               <Joint fill={colorFar} r={14} />
                            </g>
                      </g>

                      <g transform="rotate(90)">
                        <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                      </g>
                      <path d={paths.head} fill={colorSkin} transform="translate(-80, 0) rotate(90)" />

                      <g transform="translate(150, 50) rotate(60)">
                           <path d={paths.foot} fill={colorNear} />
                      </g>
                      <g transform="translate(0, 50)">
                            <g style={{ animation: 'vector-pushup-arm 3s ease-in-out infinite', transformOrigin: '0 -20' }} transform="translate(0, -20)">
                                <ArmGroup fill={colorNear} />
                                <Joint fill={colorNear} r={16} />
                                <g transform="translate(0, 55)">
                                    <g style={{ animation: 'vector-pushup-forearm 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                        <path d={paths.forearm} fill={colorNear} />
                                        <Joint fill={colorNear} r={14} />
                                    </g>
                                </g>
                            </g>
                      </g>
                  </g>
              </g>
          )
      }
      return (
          <g transform="translate(0, 50)">
              <g style={{ animation: 'vector-squat-hips-front 3s ease-in-out infinite' }}>
                  <g transform="rotate(90)">
                     <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                  </g>
                  <path d={paths.head} fill={colorHair} transform="translate(-90, 0) rotate(90)" />
                  
                  <g transform="translate(-65, -35)">
                      <g style={{ animation: 'vector-pushup-arm-left 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                        <ArmGroup fill={colorNear} />
                        <Joint fill={colorNear} r={16} />
                        <path d={paths.forearm} fill={colorNear} transform="translate(0, 55) rotate(-90)" />
                        <Joint fill={colorNear} r={14} transform="translate(0, 55)" />
                      </g>
                  </g>
                  
                  <g transform="translate(-65, 35)">
                      <g style={{ animation: 'vector-pushup-arm-right 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                        <ArmGroup fill={colorNear} />
                        <Joint fill={colorNear} r={16} />
                        <path d={paths.forearm} fill={colorNear} transform="translate(0, 55) rotate(-90)" />
                        <Joint fill={colorNear} r={14} transform="translate(0, 55)" />
                      </g>
                  </g>
              </g>
          </g>
      )
  };

  const renderLunge = (isSide: boolean, isBack: boolean) => {
      if (isSide) {
          return (
              <g transform="translate(0, 100)">
                   <g style={{ animation: 'vector-lunge-drop 3s ease-in-out infinite' }}>
                       <g transform="translate(20, -10)">
                            <g style={{ animation: 'vector-lunge-back-thigh 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                <LegGroup fill={colorFar} />
                                <Joint fill={colorFar} r={20} />
                                <g transform="translate(0, 75)">
                                    <g style={{ animation: 'vector-lunge-back-shin 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                        <Muscle d={paths.calf} name="calves" fill={colorFar} />
                                        <Joint fill={colorFar} r={14} />
                                    </g>
                                </g>
                            </g>
                       </g>
                       
                       <g transform="translate(0, -100)">
                           <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                       </g>
                       <path d={paths.head} fill={colorSkin} transform="translate(0, -175)" />
                       
                       <g transform="translate(0, -145)">
                           <ArmGroup fill={colorNear} />
                           <Joint fill={colorNear} r={16} />
                           <path d={paths.forearm} fill={colorNear} transform="translate(0, 55)" />
                           <Joint fill={colorNear} r={14} transform="translate(0, 55)" />
                       </g>

                       <g transform="translate(-20, -10)">
                            <g style={{ animation: 'vector-lunge-front-thigh 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                <LegGroup fill={colorNear} />
                                <Joint fill={colorNear} r={20} />
                                <g transform="translate(0, 75)">
                                    <g style={{ animation: 'vector-lunge-front-shin 3s ease-in-out infinite', transformOrigin: '0 0' }}>
                                        <Muscle d={paths.calf} name="calves" fill={colorNear} />
                                        <Joint fill={colorNear} r={14} />
                                    </g>
                                </g>
                            </g>
                       </g>
                   </g>
              </g>
          )
      }
      return (
        <g transform="translate(0, 100)">
             <g style={{ animation: 'vector-lunge-drop 3s ease-in-out infinite' }}>
                 <g transform="translate(25, -30) scale(0.9)">
                    <LegGroup fill={colorFar} isBack={isBack} />
                    <Muscle d={paths.calf} name="calves" fill={colorFar} />
                 </g>
                 
                 <g transform="translate(0, -100)">
                     <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                 </g>
                 <path d={paths.head} fill={isBack ? colorHair : colorSkin} transform="translate(0, -175)" />
                 
                 <g transform="translate(-25, 0)">
                    <LegGroup fill={colorNear} isBack={isBack} />
                    <Joint fill={colorNear} r={20} />
                    <Muscle d={paths.shin} name="calves" fill={colorNear} />
                    <Joint fill={colorNear} r={14} transform="translate(0, 75)" />
                 </g>
             </g>
        </g>
      );
  };

  const renderCurl = (isSide: boolean, isBack: boolean) => {
      return (
          <g transform="translate(0, 100)">
              {isSide && (
                  <g transform="translate(15, -145)">
                       <ArmGroup fill={colorFar} />
                       <Joint fill={colorFar} r={16} />
                       <g transform="translate(0, 55)">
                           <g style={{ animation: 'vector-curl-lower 3s infinite', transformOrigin: '0 0' }}>
                               <path d={paths.forearm} fill={colorFar} />
                               <Joint fill={colorFar} r={14} />
                               <g transform="translate(0, 55)">
                                  <rect x="-15" y="-5" width="30" height="10" fill="#1e293b" rx="4" />
                                  <circle cx="-18" cy="0" r="10" fill={colorWeight} />
                                  <circle cx="18" cy="0" r="10" fill={colorWeight} />
                               </g>
                           </g>
                       </g>
                  </g>
              )}

              <g transform="translate(0, 0)">
                  <g transform="translate(0, -100)">
                      <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                  </g>
                  <path d={paths.head} fill={isBack ? colorHair : colorSkin} transform="translate(0, -175)" />
                  
                  <g transform="translate(-22, 0)">
                    <LegGroup fill={colorNear} isBack={isBack} />
                    <Muscle d={paths.shin} name="calves" fill={colorNear} />
                    <Joint fill={colorNear} r={20} />
                    <Joint fill={colorNear} r={14} transform="translate(0, 75)" />
                  </g>
                  {!isSide && (
                    <g transform="translate(22, 0)">
                       <LegGroup fill={colorNear} isBack={isBack} />
                       <Muscle d={paths.shin} name="calves" fill={colorNear} />
                       <Joint fill={colorNear} r={20} />
                       <Joint fill={colorNear} r={14} transform="translate(0, 75)" />
                    </g>
                  )}
              </g>

              {/* Front Left / Side Front Arm */}
              <g transform={`translate(${isSide ? '-10' : '-50'}, -145)`}>
                   <ArmGroup fill={colorNear} />
                   <Joint fill={colorNear} r={16} />
                   <g transform="translate(0, 55)">
                       <g style={{ animation: 'vector-curl-lower 3s infinite', transformOrigin: '0 0' }}>
                           <path d={paths.forearm} fill={colorNear} />
                           <Joint fill={colorNear} r={14} />
                           <g transform="translate(0, 55)">
                              <rect x="-15" y="-5" width="30" height="10" fill="#1e293b" rx="4" />
                              <circle cx="-18" cy="0" r="12" fill={colorWeight} />
                              <circle cx="18" cy="0" r="12" fill={colorWeight} />
                           </g>
                       </g>
                   </g>
              </g>
              
              {/* Front Right Arm */}
              {!isSide && (
                  <g transform="translate(50, -145)">
                       <ArmGroup fill={colorNear} />
                       <Joint fill={colorNear} r={16} />
                       <g transform="translate(0, 55)">
                           <g style={{ animation: 'vector-curl-lower 3s infinite', transformOrigin: '0 0' }}>
                               <path d={paths.forearm} fill={colorNear} />
                               <Joint fill={colorNear} r={14} />
                               <g transform="translate(0, 55)">
                                  <rect x="-15" y="-5" width="30" height="10" fill="#1e293b" rx="4" />
                                  <circle cx="-18" cy="0" r="12" fill={colorWeight} />
                                  <circle cx="18" cy="0" r="12" fill={colorWeight} />
                               </g>
                           </g>
                       </g>
                  </g>
              )}
          </g>
      )
  };

  const renderTricep = (isSide: boolean, isBack: boolean) => {
      // 1. Forearm Component (Dynamic Animation)
      // Pivot: top of forearm (0,0) which matches elbow position
      const TricepForearm = ({ color, animated }: { color: string, animated: boolean }) => (
         <g style={animated ? { animation: 'vector-tricep-forearm 3s infinite', transformOrigin: '0 0' } : { transform: 'rotate(175deg)' }}>
            <path d={paths.forearm} fill={color} />
            <Joint fill={color} r={14} />
             <g transform="translate(0, 45)">
                <rect x="-15" y="-5" width="30" height="10" fill="#1e293b" rx="4" />
                <circle cx="-18" cy="0" r="12" fill={colorWeight} />
                <circle cx="18" cy="0" r="12" fill={colorWeight} />
            </g>
         </g>
      );
      
      // 2. Upper Arm Component (Bicep/Tricep only, no Deltoid)
      const UpperArmPart = ({ color }: { color: string }) => (
          <g>
              <Muscle d={paths.bicep} name="biceps" fill={color} /> 
              <Muscle d={paths.tricep} name="triceps" fill={color} side />
          </g>
      );

      // Pivot Logic:
      // Shoulder: -145
      // Arm Length: 60 (visual) after scaling
      // Translation shift: -25 to close gap
      // Elbow Pivot Y: -145 - 60 = -205
      
      return (
          <g transform="translate(0, 100)">
               
               {/* FRONT VIEW: Forearm renders BEHIND Head/Body (Layer 0) */}
               {!isSide && !isBack && (
                   <g transform="translate(-50, -205)">
                        <TricepForearm color={colorFar} animated={true} />
                   </g>
               )}

               {/* BODY LAYER (Layer 1) */}
               <g transform="translate(0, -100)">
                    <TorsoGroup fill={colorNear} detailColor={colorDetail} />
               </g>
               
               <g transform="translate(-22, 0)">
                  <LegGroup fill={colorNear} isBack={isBack} />
                  <Joint fill={colorNear} r={20} />
                  <Muscle d={paths.shin} name="calves" fill={colorNear} />
                  <Joint fill={colorNear} r={14} transform="translate(0, 75)" />
               </g>

               {!isSide && (
                    <g transform="translate(22, 0)">
                        <LegGroup fill={colorNear} isBack={isBack} />
                        <Joint fill={colorNear} r={20} />
                        <Muscle d={paths.shin} name="calves" fill={colorNear} />
                        <Joint fill={colorNear} r={14} transform="translate(0, 75)" />
                    </g>
               )}

               <path d={paths.head} fill={isBack ? colorHair : colorSkin} transform="translate(0, -175)" />

               {/* PASSIVE DELTOID (Right Side) - NO ARM */}
               {!isSide && (
                   <g transform="translate(50, -145)">
                        <Muscle d={paths.delt} name="delts" fill={colorNear} />
                        <Joint fill={colorNear} r={16} />
                   </g>
               )}
               
               {/* ACTIVE ARM ASSEMBLY (Left Side) */}
               {/* 1. Deltoid (Upright) */}
               <g transform={`translate(${isSide ? '0' : '-50'}, -145)`}>
                    <Muscle d={paths.delt} name="delts" fill={colorNear} />
                    {/* Bridge Gap: Extra Joint circle at shoulder pivot */}
                    <Joint fill={colorNear} r={24} /> 
               </g>
               
               {/* 2. Upper Arm (Rotated 180 to point up) */}
               {/* Shifted up by -25px locally to close the gap to pivot, and scaled to be longer */}
               <g transform={`translate(${isSide ? '0' : '-50'}, -145) rotate(180)`}>
                    <g transform="scale(1, 1.5) translate(0, -25)">
                        <UpperArmPart color={colorNear} />
                    </g>
               </g>

               {/* 3. Elbow Joint (At top of inverted arm) */}
               <g transform={`translate(${isSide ? '0' : '-50'}, -205)`}>
                   <Joint fill={colorNear} r={14} />
               </g>

               {/* SIDE/BACK VIEW: Forearm renders IN FRONT (Layer 2) */}
               {(isSide || isBack) && (
                   <g transform={`translate(${isSide ? '0' : '-50'}, -205)`}>
                       <TricepForearm color={colorNear} animated={true} />
                   </g>
               )}
          </g>
      )
  };

  const renderPlank = (isSide: boolean) => {
      if (isSide) {
          return (
               <g transform="translate(-50, 150)">
                    <line x1="-150" y1="50" x2="250" y2="50" stroke="#334155" strokeWidth="4" />
                    <g style={{ animation: 'vector-plank-hover 3s ease-in-out infinite' }}>
                        <path d={paths.foot} fill={colorFar} transform="translate(150, 40) rotate(90)" />
                        <g transform="translate(-50, 45)">
                            <path d={paths.forearm} fill={colorFar} transform="rotate(90)" />
                        </g>
                        
                        <rect x="-65" y="-15" width="230" height="40" rx="15" fill={colorNear} />
                        <path d={paths.head} fill={colorSkin} transform="translate(-80, 5)" />
                        
                        <path d={paths.foot} fill={colorNear} transform="translate(150, 45) rotate(90)" />
                        
                        <g transform="translate(-50, 15)">
                            <ArmGroup fill={colorNear} />
                            <Joint fill={colorNear} r={16} />
                            <g transform="translate(0, 55)">
                                <path d={paths.forearm} fill={colorNear} transform="rotate(90)" />
                                <Joint fill={colorNear} r={14} />
                            </g>
                        </g>
                    </g>
               </g>
          )
      }
      return (
          <g transform="translate(0, 100)">
               <g style={{ animation: 'vector-plank-hover 3s ease-in-out infinite' }}>
                   <path d={paths.head} fill={colorHair} transform="translate(0, -175)" />
                   <g transform="translate(0, -100)">
                       <TorsoGroup fill={colorNear} detailColor={colorDetail} />
                   </g>
                   
                   <g transform="translate(-40, -145)">
                       <ArmGroup fill={colorNear} />
                       <Joint fill={colorNear} r={16} />
                   </g>
                   <g transform="translate(40, -145)">
                       <ArmGroup fill={colorNear} />
                       <Joint fill={colorNear} r={16} />
                   </g>
               </g>
          </g>
      )
  };

  const renderMannequin = () => {
      const isSide = view === 'SIDE';
      const isBack = view === 'BACK';

      switch (workoutType) {
          case WorkoutType.SQUAT: return renderSquat(isSide, isBack);
          case WorkoutType.PUSHUP: return renderPushup(isSide);
          case WorkoutType.LUNGE: return renderLunge(isSide, isBack);
          case WorkoutType.BICEP_CURL: return renderCurl(isSide, isBack);
          case WorkoutType.TRICEP_EXTENSION: return renderTricep(isSide, isBack);
          case WorkoutType.PLANK: return renderPlank(isSide);
          default: return null;
      }
  };

  return (
    <div className="w-full h-full bg-slate-900/50 flex flex-col items-center justify-center relative">
        <div className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur border border-slate-700 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 font-bold tracking-widest z-10">
            VIEW: {view}
        </div>

        <div className="w-full h-full max-w-[300px] max-h-[500px]">
             <svg viewBox={VIEWBOX} className="w-full h-full drop-shadow-2xl overflow-visible">
                  {renderMannequin()}
             </svg>
        </div>
    </div>
  );
};
