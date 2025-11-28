import React, { useState, useCallback, useRef } from 'react';
import { CameraView } from './components/CameraView';
import { FeedbackPanel } from './components/FeedbackPanel';
import { ReferenceVisualizer } from './components/ReferenceVisualizer';
import { WORKOUTS } from './constants';
import { WorkoutType, LogMessage } from './types';
import { GeminiLiveService } from './services/geminiLive';
import { Activity, Play, Square, AlertCircle, Info, Dumbbell } from 'lucide-react';

export default function App() {
  const [activeWorkout, setActiveWorkout] = useState<WorkoutType>(WorkoutType.SQUAT);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    videoElementRef.current = video;
  }, []);

  const addLog = useCallback((text: string, role: 'user' | 'model') => {
    setLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        role,
        text,
        timestamp: new Date()
    }]);
  }, []);

  const updateFeedback = useCallback((text: string | null) => {
      setLatestFeedback(text);
      // Clear previous timeout if any
      if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
      
      // If text is set, clear it after 5 seconds to let heuristic feedback shine through
      if (text) {
          feedbackTimeoutRef.current = window.setTimeout(() => {
              setLatestFeedback(null);
          }, 5000);
      }
  }, []);

  const toggleSession = async () => {
    if (isConnected) {
        // Disconnect
        if (serviceRef.current) {
            await serviceRef.current.disconnect();
            serviceRef.current = null;
        }
        setIsConnected(false);
        updateFeedback(null);
        addLog("Session ended.", 'system');
    } else {
        // Connect
        if (!process.env.API_KEY) {
            setError("API Key not found in environment.");
            return;
        }
        if (!videoElementRef.current) {
            setError("Camera not ready.");
            return;
        }

        setError(null);
        updateFeedback("Align with the ghost overlay!");
        
        const service = new GeminiLiveService({
            apiKey: process.env.API_KEY,
            onTranscription: (text, role) => {
                addLog(text, role);
                if (role === 'model') {
                    updateFeedback(text);
                }
            },
            onConnect: () => {
                setIsConnected(true);
                updateFeedback("Align with the ghost overlay!");
                addLog("Connected! Watch the model and align your form.", 'system');
            },
            onDisconnect: () => {
                setIsConnected(false);
                serviceRef.current = null;
                updateFeedback(null);
            },
            onError: (err) => {
                setError(err.message);
                setIsConnected(false);
                updateFeedback("Connection Error");
            }
        });

        try {
            await service.connect(activeWorkout, videoElementRef.current);
            serviceRef.current = service;
        } catch (e) {
            console.error(e);
            setError("Failed to connect to Live API");
            updateFeedback("Failed to connect");
        }
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-950 text-slate-200 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-xl flex-shrink-0 h-auto md:h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <Activity className="text-emerald-500" />
                    <h1 className="text-xl font-bold text-white tracking-tight">FormFit AI</h1>
                </div>
                <p className="text-xs text-slate-500">Video Analysis Only • No Mic Required</p>
            </div>

            {/* Action Button (Moved to Top) */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-xs">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}
                <button
                    onClick={toggleSession}
                    className={`
                        w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-95
                        ${isConnected 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'}
                    `}
                >
                    {isConnected ? (
                        <>
                            <Square size={20} fill="currentColor" />
                            STOP SESSION
                        </>
                    ) : (
                        <>
                            <Play size={20} fill="currentColor" />
                            START ANALYSIS
                        </>
                    )}
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Workout Selector */}
                <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Workout</label>
                    <div className="grid grid-cols-1 gap-2">
                        {Object.values(WORKOUTS).map((workout) => (
                            <button
                                key={workout.id}
                                onClick={() => !isConnected && setActiveWorkout(workout.id)}
                                disabled={isConnected}
                                className={`
                                    px-4 py-3 rounded-xl text-left transition-all duration-200 border
                                    ${activeWorkout === workout.id 
                                        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                                        : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                                    ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="font-medium flex items-center justify-between">
                                    {workout.name}
                                    {activeWorkout === workout.id && <Dumbbell size={16} />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                        <Info size={16} />
                        <span className="text-sm font-semibold">Correct Form</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {WORKOUTS[activeWorkout].description}
                    </p>
                    <ul className="mt-3 space-y-1">
                        {WORKOUTS[activeWorkout].tips.map((tip, i) => (
                            <li key={i} className="text-xs text-slate-500 flex items-center gap-2">
                                <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
             {/* Header Overlay for mobile */}
             <div className="absolute top-0 left-0 right-0 p-4 md:hidden z-10 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                 <h1 className="font-bold text-white drop-shadow-md">FormFit AI</h1>
                 <div className="text-xs bg-slate-800/80 backdrop-blur px-2 py-1 rounded text-slate-300 border border-white/10">{WORKOUTS[activeWorkout].name}</div>
             </div>

            {/* Increased top padding (pt-14 md:pt-10) to give space for video/demo display at the top */}
            <div className="flex-1 p-4 md:p-6 pt-14 md:pt-10 flex flex-col gap-6 overflow-hidden">
                
                {/* Visual Stage: Side by Side */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                    
                    {/* Left: Reference Model */}
                    <div className="relative flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
                        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                            DEMO MODE
                        </div>
                        <ReferenceVisualizer workoutType={activeWorkout} />
                    </div>

                    {/* Right: Camera */}
                    <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-700">
                        <CameraView 
                            workoutType={activeWorkout} 
                            isActive={isConnected}
                            onVideoReady={handleVideoReady}
                            feedback={latestFeedback}
                        />
                         {/* Live Indicator Overlay - Moved down to top-20 to avoid overlap with Radial Gauge */}
                        {isConnected && (
                            <div className="absolute top-20 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex items-center gap-3 z-10 transition-all duration-300">
                                <div className="flex space-x-1 items-end h-4">
                                    <div className="w-1 h-2 bg-emerald-500 animate-[bounce_1s_infinite]" />
                                    <div className="w-1 h-3 bg-emerald-500 animate-[bounce_1.2s_infinite]" />
                                    <div className="w-1 h-4 bg-emerald-500 animate-[bounce_0.8s_infinite]" />
                                </div>
                                <span className="text-xs font-mono text-emerald-400">ANALYZING</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Logs Area */}
                <div className="h-40 md:h-48 flex-shrink-0 hidden md:block">
                    <FeedbackPanel logs={logs} />
                </div>
            </div>
        </main>
    </div>
  );
}