'use client';

import { useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar, useVoiceAssistant } from '@livekit/components-react';
import '@livekit/components-styles';
import { Phone, PhoneOff, ShieldAlert } from 'lucide-react';

export default function Home() {
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/token');
      const data = await response.json();
      if (data.token && data.url) {
        setConnectionDetails(data);
      } else {
        console.error('Respuesta incompleta del endpoint de token:', data);
      }
    } catch (error) {
      console.error('Error al obtener token:', error);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnectionDetails(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-slate-950 text-white p-6 font-sans">
      <div className="flex flex-col items-center gap-2 mt-12 text-center">
        <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20 text-red-500 animate-pulse">
          <ShieldAlert size={48} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">RAG Emergencias</h1>
        <p className="text-sm text-slate-400 max-w-xs">
          Asistente de Voz en Tiempo Real para operadores en el lugar del siniestro.
        </p>
      </div>

      <div className="w-full flex flex-col items-center justify-center flex-grow py-8">
        {!connectionDetails ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex flex-col items-center justify-center gap-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all text-white w-40 h-40 rounded-full shadow-lg shadow-emerald-950/50 border border-emerald-400/20 cursor-pointer"
          >
            <Phone size={44} />
            <span className="text-sm font-semibold">{connecting ? 'Conectando...' : 'Iniciar Llamada'}</span>
          </button>
        ) : (
          <LiveKitRoom
            token={connectionDetails.token}
            serverUrl={connectionDetails.url}
            connect={true}
            audio={true}
            onDisconnected={handleDisconnect}
            className="flex flex-col items-center justify-center gap-8 w-full"
          >
            <AgentVisualizer />
            <RoomAudioRenderer />
            <VoiceAssistantControlBar />
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white px-6 py-3 rounded-full font-medium border border-red-400/20 cursor-pointer"
            >
              <PhoneOff size={20} />
              Terminar Comunicación
            </button>
          </LiveKitRoom>
        )}
      </div>

      <div className="text-xs text-slate-600 pb-4">
        Voz bidireccional cifrada y de baja latencia.
      </div>
    </main>
  );
}

function AgentVisualizer() {
  const { state } = useVoiceAssistant();
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative flex items-center justify-center w-32 h-32 rounded-full border transition-all duration-500 ${
        state === 'speaking' 
          ? 'bg-red-500/20 border-red-500 animate-pulse scale-105' 
          : state === 'listening' 
          ? 'bg-emerald-500/10 border-emerald-500/40' 
          : 'bg-slate-900 border-slate-800'
      }`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {state === 'speaking' ? 'Agente Hablando' : state === 'listening' ? 'Escuchándote' : 'En espera'}
        </span>
      </div>
    </div>
  );
}
