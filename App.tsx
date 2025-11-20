import React from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import Visualizer from './components/Visualizer';
import Transcript from './components/Transcript';

const App: React.FC = () => {
  const { 
    connect, 
    disconnect, 
    isConnected, 
    isConnecting, 
    error, 
    volume, 
    transcripts 
  } = useGeminiLive();

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      
      {/* Header / Brand */}
      <div className="absolute top-6 md:top-10 text-center z-10">
        <h1 className="text-3xl font-bold text-odoo-purple tracking-tight">
          Odoo <span className="text-odoo-teal font-light">Live</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Agente de Ventas IA • Rosa</p>
      </div>

      {/* Main Interaction Area */}
      <div className="flex flex-col items-center justify-center w-full max-w-lg z-10 space-y-8">
        
        {/* Visualizer Container */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <Visualizer isActive={isConnected} volume={volume} />
          </div>
          
          {/* Center Button */}
          <button
            onClick={handleToggleConnection}
            disabled={isConnecting}
            className={`relative z-20 w-20 h-20 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 ${
              isConnected 
                ? 'bg-red-500 hover:bg-red-600 focus:ring-red-200 text-white' 
                : 'bg-odoo-teal hover:bg-teal-700 focus:ring-teal-200 text-white'
            } ${isConnecting ? 'opacity-70 cursor-wait' : ''}`}
            aria-label={isConnected ? "Terminar llamada" : "Iniciar llamada"}
          >
            {isConnecting ? (
               <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
            ) : isConnected ? (
              /* Hangup Icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" transform="rotate(135 10 10)" />
              </svg>
            ) : (
              /* Mic Icon */
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="h-6 text-center">
           {error ? (
             <span className="text-red-500 text-sm font-medium px-3 py-1 bg-red-50 rounded-full">{error}</span>
           ) : isConnected ? (
             <span className="text-odoo-teal text-sm font-medium animate-pulse">Escuchando...</span>
           ) : (
             <span className="text-slate-400 text-sm">Presiona para hablar con Rosa</span>
           )}
        </div>

        {/* Transcript Area */}
        <div className="w-full">
          <Transcript items={transcripts} />
        </div>

      </div>

      {/* Footer Info */}
      <footer className="absolute bottom-4 text-xs text-slate-400 text-center w-full">
        <p>Desarrollado con Google Gemini Live API & Web Audio API</p>
      </footer>
    </main>
  );
};

export default App;