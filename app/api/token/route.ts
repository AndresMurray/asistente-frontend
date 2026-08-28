import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const room = request.nextUrl.searchParams.get('room') || `emergencias-${Math.random().toString(36).substring(7)}`;
  const username = 'operador-' + Math.random().toString(36).substring(7);
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Falta configurar variables de entorno de LiveKit (LIVEKIT_API_KEY / LIVEKIT_API_SECRET)' }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: username });
  at.addGrant({ 
    roomJoin: true, 
    room: room, 
    canPublish: true, 
    canSubscribe: true 
  });

  at.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({
        agentName: 'asistente-emergencias',
      }),
    ],
  });

  const token = await at.toJwt();
  return NextResponse.json({ token, url: livekitUrl });
}
