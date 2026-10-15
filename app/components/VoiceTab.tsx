'use client';

import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useLocalParticipant,
  useVoiceAssistant,
} from '@livekit/components-react';
import { useKrispNoiseFilter } from '@livekit/components-react/krisp';
import '@livekit/components-styles';
import { Phone, PhoneOff, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';

// Si el saludo no termina en este tiempo, el micrófono se habilita igual.
const ESPERA_MAXIMA_SALUDO_MS = 45_000;

export default function VoiceTab() {
  const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Se pide el permiso del micrófono ahora, al tocar el botón, para que el
      // navegador no lo pregunte justo cuando termina el saludo.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (error) {
        console.error('Sin permiso de micrófono:', error);
      }
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
          // El micrófono arranca apagado: se prende cuando el asistente termina
          // de saludar. Si se hablaba antes (el agente tarda unos segundos en
          // despertar si estaba dormido), la conversación se desordenaba.
          audio={false}
          onDisconnected={handleDisconnect}
          className="flex flex-col items-center justify-center gap-8 w-full"
        >
          <Llamada onTerminar={handleDisconnect} />
        </LiveKitRoom>
      )}
    </div>
  );
}

/** Prende el micrófono recién cuando el asistente terminó el saludo. */
function useMicrofonoDespuesDelSaludo() {
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const [saludoEmpezo, setSaludoEmpezo] = useState(false);
  const [tiempoAgotado, setTiempoAgotado] = useState(false);

  // El agente pasa por «listening» ANTES de saludar (al arrancar la sesión),
  // así que lo que cuenta es haber hablado y después volver a escuchar.
  if (state === 'speaking' && !saludoEmpezo) setSaludoEmpezo(true);
  const listo = (saludoEmpezo && state === 'listening') || tiempoAgotado;
  const [microfonoPrendido, setMicrofonoPrendido] = useState(false);
  const [errorMicrofono, setErrorMicrofono] = useState(false);
  if (listo && !microfonoPrendido) setMicrofonoPrendido(true);

  useEffect(() => {
    const t = setTimeout(() => setTiempoAgotado(true), ESPERA_MAXIMA_SALUDO_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (microfonoPrendido) {
      localParticipant.setMicrophoneEnabled(true).catch((error) => {
        console.error('No se pudo prender el micrófono:', error);
        setErrorMicrofono(true);
      });
    }
  }, [microfonoPrendido, localParticipant]);

  return { saludoEmpezo, microfonoPrendido, errorMicrofono };
}

function Llamada({ onTerminar }: { onTerminar: () => void }) {
  const { saludoEmpezo, microfonoPrendido, errorMicrofono } = useMicrofonoDespuesDelSaludo();

  return (
    <>
      <AgentVisualizer microfonoPrendido={microfonoPrendido} />
      {!microfonoPrendido && (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-full">
          <Loader2 size={12} className="animate-spin" />
          <span>
            {saludoEmpezo
              ? 'Escuchá el saludo: el micrófono se activa cuando termine.'
              : 'Conectando con el asistente… La primera llamada puede tardar unos segundos.'}
          </span>
        </div>
      )}
      {errorMicrofono && (
        <div className="text-xs font-medium text-red-300 bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded-full">
          No se pudo usar el micrófono: revisá que el navegador tenga permiso y que haya uno conectado.
        </div>
      )}
      <NoiseFilterControl />
      <RoomAudioRenderer />
      {microfonoPrendido && <VoiceAssistantControlBar />}
      <button
        onClick={onTerminar}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white px-6 py-3 rounded-full font-medium border border-red-400/20 cursor-pointer"
      >
        <PhoneOff size={20} />
        Terminar Comunicación
      </button>
    </>
  );
}

/** Krisp noise cancellation toggle - auto-enables on mount. */
function NoiseFilterControl() {
  const krisp = useKrispNoiseFilter();
  const [autoEnabled, setAutoEnabled] = useState(false);

  // Auto-enable on first render once the processor is ready
  useEffect(() => {
    if (!autoEnabled && !krisp.isNoiseFilterEnabled && !krisp.isNoiseFilterPending) {
      krisp.setNoiseFilterEnabled(true);
      setAutoEnabled(true);
    }
  }, [autoEnabled, krisp]);

  const toggle = () => {
    krisp.setNoiseFilterEnabled(!krisp.isNoiseFilterEnabled);
  };

  return (
    <button
      onClick={toggle}
      disabled={krisp.isNoiseFilterPending}
      title={krisp.isNoiseFilterEnabled ? 'Filtro de ruido activo - clic para desactivar' : 'Filtro de ruido inactivo - clic para activar'}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
        krisp.isNoiseFilterPending
          ? 'bg-slate-800 border-slate-700 text-slate-500'
          : krisp.isNoiseFilterEnabled
          ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/60'
      }`}
    >
      {krisp.isNoiseFilterPending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : krisp.isNoiseFilterEnabled ? (
        <ShieldCheck size={14} />
      ) : (
        <ShieldOff size={14} />
      )}
      {krisp.isNoiseFilterPending
        ? 'Cargando filtro...'
        : krisp.isNoiseFilterEnabled
        ? 'Filtro de Ruido ON'
        : 'Filtro de Ruido OFF'}
    </button>
  );
}

function AgentVisualizer({ microfonoPrendido }: { microfonoPrendido: boolean }) {
  const { state } = useVoiceAssistant();

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative flex flex-col items-center justify-center w-36 h-36 rounded-full border transition-all duration-500 ${
          state === 'speaking'
            ? 'bg-red-500/20 border-red-500 animate-pulse scale-105 shadow-lg shadow-red-950/50'
            : state === 'listening'
            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
            : state === 'thinking'
            ? 'bg-blue-500/20 border-blue-400 animate-pulse scale-105 shadow-lg shadow-blue-950/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        {state === 'thinking' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={26} className="animate-spin text-blue-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-300 text-center px-2">
              Analizando...
            </span>
          </div>
        ) : (
          <span
            className={`text-xs font-semibold uppercase tracking-wider text-center px-2 ${
              state === 'speaking'
                ? 'text-red-300'
                : state === 'listening'
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {state === 'speaking'
              ? 'Agente Hablando'
              : state === 'listening'
              ? microfonoPrendido ? 'Escuchándote' : 'Conectando'
              : 'En espera'}
          </span>
        )}
      </div>

      {state === 'thinking' && (
        <div className="flex items-center gap-2 text-xs font-medium text-blue-400 animate-pulse bg-blue-950/40 border border-blue-800/40 px-3 py-1.5 rounded-full">
          <Loader2 size={12} className="animate-spin" />
          <span>Consultando protocolos de emergencia...</span>
        </div>
      )}
    </div>
  );
}
