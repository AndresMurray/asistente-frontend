'use client';

import { useState, useRef, useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Phone, PhoneOff, ChevronDown, ChevronRight, Search, Clock, Bot, User, Loader2, Settings, Zap } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  debug?: DebugData;
}

interface DebugData {
  tool_calls: ToolCall[];
  llm_metrics: LLMMetrics | null;
  config: SystemConfig;
  total_response_ms?: number;
  search_count?: number;
}

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  status?: string;
  error?: string | null;
  chunks_found?: number;
  top_score?: number | null;
  total_latency_ms?: number;
  embed_ms?: number;
  vector_search_ms?: number;
  rerank_ms?: number;
  candidate_count?: number;
  reranked?: boolean;
  fragments?: Fragment[];
  context_for_llm?: string | null;
  saved_fields?: string[];
  was_critical?: boolean;
  triage_brief?: string;
}

interface Fragment {
  text: string;
  score: number;
  section: string | null;
  subsection: string | null;
  page_start: number | null;
  page_end: number | null;
}

interface LLMMetrics {
  e2e_latency_ms: number | null;
  llm_ttft_ms: number | null;
  tts_ttfb_ms: number | null;
  playback_latency_ms: number | null;
  end_of_turn_delay_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  tokens_per_second: number | null;
}

interface SystemConfig {
  llm_model: string;
  embed_model: string;
  rerank_enabled: boolean;
  rerank_model: string | null;
  top_k: number;
  k_vector: number;
  min_score: number;
  rerank_min_score: number | null;
}

export default function TestTab() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch('/api/token');
      const data = await response.json();
      if (!data.token || !data.url) {
        console.error('Token incompleto:', data);
        return;
      }

      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      r.on(RoomEvent.Connected, () => {
        setConnected(true);
        setConnecting(false);
      });

      r.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        roomRef.current = null;
      });

      r.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        if (topic !== 'test-chat') return;
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          if (data.type === 'chat_reply' || data.type === 'chat_reply_debug') {
            const debug: DebugData | undefined = data.type === 'chat_reply_debug'
              ? {
                  tool_calls: data.tool_calls || [],
                  llm_metrics: data.llm_metrics || null,
                  config: data.config || {} as SystemConfig,
                  total_response_ms: data.total_response_ms,
                  search_count: data.search_count,
                }
              : undefined;

            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.message,
              timestamp: Date.now(),
              debug,
            }]);
            setSending(false);
          }
        } catch (e) {
          console.error('Error parseando data:', e);
        }
      });

      await r.connect(data.url, data.token);
      roomRef.current = r;
      setConnected(true);
    } catch (error) {
      console.error('Error conectando:', error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setConnected(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !roomRef.current || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    const payload = JSON.stringify({
      type: 'chat_request',
      message: input.trim(),
      debug: true,
    });

    setInput('');

    try {
      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { topic: 'test-chat', reliable: true },
      );
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Connection bar */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : connecting ? 'bg-yellow-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">
            {connected ? 'Conectado al agente' : connecting ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>
        {!connected ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <Phone size={16} />
            {connecting ? 'Conectando...' : 'Conectar'}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <PhoneOff size={16} />
            Desconectar
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-600 mt-20">
            <Bot size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">Conectate al agente y escribí una consulta para testear el pipeline RAG.</p>
            <p className="text-xs mt-2 text-slate-700">Ejemplo: &quot;qué hago si alguien no respira&quot;</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? "Escribí tu consulta..." : "Conectate primero..."}
            disabled={!connected || sending}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim() || sending}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
        isUser
          ? 'bg-emerald-600/20 border border-emerald-500/30'
          : 'bg-slate-800 border border-slate-700'
      }`}>
        <div className="flex items-start gap-2">
          {isUser ? <User size={16} className="text-emerald-400 mt-0.5 shrink-0" /> : <Bot size={16} className="text-blue-400 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{message.content}</p>

            {/* Debug panel */}
            {message.debug && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Zap size={12} />
                  Debug info
                </button>

                {expanded && (
                  <DebugPanel debug={message.debug} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DebugPanel({ debug }: { debug: DebugData }) {
  return (
    <div className="mt-2 space-y-3 text-xs">
      {/* Summary */}
      <div className="flex flex-wrap gap-3 p-2 bg-slate-950/50 rounded border border-slate-800/50">
        {debug.total_response_ms != null && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-emerald-400" />
            <span className="text-slate-500">Total:</span>
            <span className="text-slate-200 font-mono font-medium">{debug.total_response_ms}ms</span>
          </div>
        )}
        {debug.search_count != null && (
          <div className="flex items-center gap-1.5">
            <Search size={12} className="text-blue-400" />
            <span className="text-slate-500">Búsquedas:</span>
            <span className="text-slate-200 font-mono font-medium">{debug.search_count}</span>
          </div>
        )}
      </div>

      {/* Tool calls */}
      {debug.tool_calls.length > 0 && (
        <div>
          <h4 className="text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
            <Search size={12} /> Tools llamadas
          </h4>
          <div className="space-y-2">
            {debug.tool_calls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </div>
        </div>
      )}

      {debug.tool_calls.length === 0 && (
        <div className="text-slate-600 italic">No se llamó ninguna tool</div>
      )}

      {/* LLM Metrics */}
      {debug.llm_metrics && (
        <div>
          <h4 className="text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
            <Clock size={12} /> Métricas LLM
          </h4>
          <MetricsGrid metrics={debug.llm_metrics} />
        </div>
      )}

      {/* Config */}
      {debug.config && Object.keys(debug.config).length > 0 && (
        <div>
          <h4 className="text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
            <Settings size={12} /> Configuración
          </h4>
          <ConfigDisplay config={debug.config} />
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall.tool;
  const isSearch = name === 'buscar_protocolo';

  return (
    <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-emerald-400">{name}</span>
          {isSearch && toolCall.status && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              toolCall.status === 'ok' ? 'bg-emerald-900/50 text-emerald-300' :
              toolCall.status === 'no_match' ? 'bg-yellow-900/50 text-yellow-300' :
              'bg-red-900/50 text-red-300'
            }`}>
              {toolCall.status}
            </span>
          )}
          {!isSearch && toolCall.saved_fields && (
            <span className="text-[10px] text-slate-500">
              guardó: {toolCall.saved_fields.join(', ')}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-800">
          {/* Search-specific details */}
          {isSearch && (
            <>
              {/* Timing breakdown */}
              {toolCall.total_latency_ms != null && (
                <TimingBar
                  embed_ms={toolCall.embed_ms || 0}
                  vector_search_ms={toolCall.vector_search_ms || 0}
                  rerank_ms={toolCall.rerank_ms || 0}
                  total_ms={toolCall.total_latency_ms}
                />
              )}

              {/* Stats */}
              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                {toolCall.chunks_found != null && (
                  <span>Chunks encontrados: <span className="text-slate-300">{toolCall.chunks_found}</span></span>
                )}
                {toolCall.candidate_count != null && (
                  <span>Candidatos pgvector: <span className="text-slate-300">{toolCall.candidate_count}</span></span>
                )}
                {toolCall.top_score != null && (
                  <span>Top score: <span className="text-slate-300">{toolCall.top_score.toFixed(3)}</span></span>
                )}
                {toolCall.reranked != null && (
                  <span>Rerank: <span className="text-slate-300">{toolCall.reranked ? 'Sí' : 'No'}</span></span>
                )}
              </div>

              {/* Fragments */}
              {toolCall.fragments && toolCall.fragments.length > 0 && (
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Chunks recuperados:</span>
                  <div className="mt-1 space-y-1.5">
                    {toolCall.fragments.map((frag, i) => (
                      <FragmentCard key={i} fragment={frag} index={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Context sent to LLM */}
              {toolCall.context_for_llm && (
                <div>
                  <span className="text-[11px] text-slate-500 font-medium">Contexto enviado al LLM:</span>
                  <pre className="mt-1 bg-slate-950 rounded p-2 text-[10px] text-slate-400 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {toolCall.context_for_llm}
                  </pre>
                </div>
              )}

              {/* Error */}
              {toolCall.error && (
                <div className="text-red-400 text-[11px] bg-red-950/30 rounded p-2">
                  Error: {toolCall.error}
                </div>
              )}
            </>
          )}

          {/* Non-search tool details */}
          {!isSearch && (
            <>
              {toolCall.was_critical != null && (
                <div className="text-[11px] text-slate-500">
                  Crítico: <span className="text-slate-300">{toolCall.was_critical ? 'Sí' : 'No'}</span>
                </div>
              )}
              {toolCall.triage_brief && (
                <div className="text-[11px] text-slate-500">
                  Estado: <span className="text-slate-300">{toolCall.triage_brief}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TimingBar({ embed_ms, vector_search_ms, rerank_ms, total_ms }: {
  embed_ms: number;
  vector_search_ms: number;
  rerank_ms: number;
  total_ms: number;
}) {
  const segments = [
    { label: 'Embed', ms: embed_ms, color: 'bg-blue-500' },
    { label: 'Vector', ms: vector_search_ms, color: 'bg-purple-500' },
    { label: 'Rerank', ms: rerank_ms, color: 'bg-orange-500' },
  ].filter(s => s.ms > 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 h-3 bg-slate-950 rounded-full overflow-hidden">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} h-full rounded-full`}
            style={{ width: `${Math.max((seg.ms / total_ms) * 100, 4)}%` }}
            title={`${seg.label}: ${seg.ms}ms`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px]">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            <span className="text-slate-500">{seg.label}:</span>
            <span className="text-slate-300">{seg.ms}ms</span>
          </span>
        ))}
        <span className="text-slate-400 font-medium">Total: {total_ms}ms</span>
      </div>
    </div>
  );
}

function FragmentCard({ fragment, index }: { fragment: Fragment; index: number }) {
  return (
    <div className="bg-slate-950/50 rounded p-2 border border-slate-800/50">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-600">
          [{index}] {fragment.section || 'sin sección'}
          {fragment.subsection ? ` > ${fragment.subsection}` : ''}
          {fragment.page_start ? ` · pág. ${fragment.page_start}` : ''}
        </span>
        <span className={`text-[10px] font-mono ${
          fragment.score >= 0.7 ? 'text-emerald-400' :
          fragment.score >= 0.5 ? 'text-yellow-400' :
          'text-red-400'
        }`}>
          {fragment.score.toFixed(3)}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 line-clamp-3">{fragment.text}</p>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: LLMMetrics }) {
  const timingItems = [
    { label: 'E2E Latency', value: metrics.e2e_latency_ms, note: metrics.e2e_latency_ms == null ? '(solo disponible en modo voz)' : null },
    { label: 'LLM TTFT', value: metrics.llm_ttft_ms },
    { label: 'TTS TTFB', value: metrics.tts_ttfb_ms },
    { label: 'Playback', value: metrics.playback_latency_ms },
    { label: 'End of Turn', value: metrics.end_of_turn_delay_ms },
  ];

  const tokenItems = [
    { label: 'Prompt Tokens', value: metrics.prompt_tokens, isToken: true },
    { label: 'Completion Tokens', value: metrics.completion_tokens, isToken: true },
    { label: 'Total Tokens', value: metrics.total_tokens, isToken: true },
    { label: 'Cached Tokens', value: metrics.cached_tokens, isToken: true },
    { label: 'Tokens/seg', value: metrics.tokens_per_second, isRate: true },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {timingItems.map((item) => (
          <div key={item.label} className="bg-slate-900/50 rounded p-2 border border-slate-800/50">
            <div className="text-[10px] text-slate-500">{item.label}</div>
            <div className="text-sm font-mono text-slate-200">
              {item.value != null ? `${(item.value * 1000).toFixed(0)}ms` : '—'}
            </div>
            {item.note && <div className="text-[9px] text-slate-600 mt-0.5">{item.note}</div>}
          </div>
        ))}
      </div>
      {tokenItems.some(i => i.value != null) && (
        <div className="grid grid-cols-3 gap-2">
          {tokenItems.map((item) => (
            <div key={item.label} className="bg-slate-900/50 rounded p-2 border border-slate-800/50">
              <div className="text-[10px] text-slate-500">{item.label}</div>
              <div className="text-sm font-mono text-slate-200">
                {item.value != null
                  ? item.isRate
                    ? `${item.value.toFixed(1)}`
                    : item.value.toLocaleString()
                  : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigDisplay({ config }: { config: SystemConfig }) {
  return (
    <div className="bg-slate-900/50 rounded p-2 border border-slate-800/50 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
      <span className="text-slate-500">LLM:</span>
      <span className="text-slate-300 font-mono">{config.llm_model}</span>
      <span className="text-slate-500">Embeddings:</span>
      <span className="text-slate-300 font-mono">{config.embed_model}</span>
      <span className="text-slate-500">Rerank:</span>
      <span className="text-slate-300">{config.rerank_enabled ? config.rerank_model : 'Off'}</span>
      <span className="text-slate-500">Top K:</span>
      <span className="text-slate-300">{config.top_k}</span>
      <span className="text-slate-500">K Vector:</span>
      <span className="text-slate-300">{config.k_vector}</span>
      <span className="text-slate-500">Min Score:</span>
      <span className="text-slate-300">{config.min_score}</span>
    </div>
  );
}
