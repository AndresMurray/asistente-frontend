'use client';

import { useState } from 'react';
import { ShieldAlert, Phone, FlaskConical } from 'lucide-react';
import VoiceTab from './components/VoiceTab';
import TestTab from './components/TestTab';

type Tab = 'voice' | 'test';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('voice');

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white font-sans">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 pt-8 pb-4 text-center">
        <div className="bg-red-500/10 p-3 rounded-full border border-red-500/20 text-red-500">
          <ShieldAlert size={36} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">RAG Emergencias</h1>
        <p className="text-xs text-slate-400 max-w-xs">
          Asistente de Voz en Tiempo Real para operadores en el lugar del siniestro.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex justify-center gap-1 px-4">
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'voice'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <Phone size={16} />
          Voz
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'test'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          <FlaskConical size={16} />
          Test
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'voice' ? <VoiceTab /> : <TestTab />}
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-600 pb-3 text-center">
        Voz bidireccional cifrada y de baja latencia.
      </div>
    </main>
  );
}
