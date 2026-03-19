import React, { useState, useEffect } from 'react';
import axios from 'axios';

// The Lock Screen component acting as the front door to the Executable
export default function LockScreen({ onUnlock }) {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('Connecting to Auth Bridge...');
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    // 1. Request Auth on load
    axios.post('http://localhost:3005/request-auth')
      .then(res => {
        setSessionId(res.data.sessionId);
        setStatus('Waiting for Mobile Approval...');
        
        // 2. Connect to WS to wait for the mobile's Approve/Deny push
        const ws = new WebSocket('ws://localhost:3005');
        ws.onopen = () => {
           ws.send(JSON.stringify({ type: 'desktop_connect', sessionId: res.data.sessionId }));
        };
        
        ws.onmessage = (e) => {
           const data = JSON.parse(e.data);
           if (data.type === 'auth_success') {
              setStatus('Local App Authenticated!');
              setTimeout(() => {
                onUnlock(data.token);
              }, 1200);
           } else if (data.type === 'auth_denied') {
              setErrorStatus('Access Denied via Mobile Device');
              setStatus(null);
           }
        };
      })
      .catch(err => {
         setErrorStatus('Failed to reach Backend Bridge Server');
         setStatus(null);
         console.error(err);
      });
  }, [onUnlock]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 font-sans p-6 selection:bg-cyan-500/30">
      <div className="bg-neutral-800 p-8 sm:p-12 rounded-2xl shadow-2xl w-full max-w-sm text-center border border-neutral-700/50 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>

        <div className="relative">
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight text-white drop-shadow-sm">Gym Tracker</h1>
          <p className="text-neutral-400 mb-8 font-medium text-sm tracking-wide">SECURE DESKTOP CLIENT</p>
          
          {errorStatus ? (
             <div className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-xl">
                 <p className="text-red-400 font-medium text-sm">{errorStatus}</p>
                 <button 
                   onClick={() => window.location.reload()}
                   className="mt-4 text-xs font-bold uppercase tracking-wider text-red-300 hover:text-white transition-colors"
                 >
                   Retry Connection
                 </button>
             </div>
          ) : sessionId ? (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
               <div className="mb-8 p-5 bg-neutral-900/80 rounded-xl border border-neutral-800 shadow-inner">
                   <p className="mb-2 uppercase text-[10px] font-bold text-neutral-500 tracking-widest">Active Auth Session</p>
                   {/* Displaying a shorter readable ID for visual appeal, could be QR code in prod */}
                   <span className="font-mono text-cyan-400 text-lg tracking-wider bg-cyan-500/10 px-3 py-1 rounded">
                     {sessionId.substring(0, 8).toUpperCase()}
                   </span>
               </div>
               
               <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative flex items-center justify-center w-12 h-12">
                     <svg className="animate-spin text-cyan-500 z-10 w-8 h-8 opacity-90" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping opacity-50"></div>
                  </div>
                  <p className="font-medium text-cyan-400 text-sm animate-pulse tracking-wide">{status}</p>
               </div>
             </div>
          ) : (
             <p className="text-neutral-500 text-sm animate-pulse">{status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
