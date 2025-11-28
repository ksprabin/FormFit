import React, { useEffect, useRef } from 'react';
import { LogMessage } from '../types';
import { User, Cpu } from 'lucide-react';

interface FeedbackPanelProps {
  logs: LogMessage[];
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // block: 'nearest' prevents the entire window from jumping if the element is already viewable or close
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-2xl p-4 backdrop-blur-sm border border-slate-700 overflow-hidden">
      <h3 className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wider">Coach Feedback</h3>
      
      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide pr-2">
        {logs.length === 0 && (
            <div className="text-slate-500 text-center text-sm mt-10 italic">
                Start a session to receive real-time corrections...
            </div>
        )}
        
        {logs.map((log) => (
          <div 
            key={log.id} 
            className={`flex gap-3 ${log.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${log.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}
            `}>
                {log.role === 'user' ? <User size={14} /> : <Cpu size={14} />}
            </div>
            
            <div className={`
                p-3 rounded-2xl text-sm max-w-[80%]
                ${log.role === 'user' 
                    ? 'bg-indigo-500/20 text-indigo-100 rounded-tr-none' 
                    : 'bg-emerald-500/20 text-emerald-100 rounded-tl-none'}
            `}>
                {log.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};