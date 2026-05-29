import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const AGENT_NAME = process.env.AGENT_NAME ?? 'code-voice-agent';

export const revalidate = 0;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Token route disabled in production without auth', {
      status: 403,
    });
  }

  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    const body = await req.json().catch(() => ({}));
    const workspacePath =
      typeof body?.workspace_path === 'string' ? body.workspace_path : '';

    let roomConfig = body?.room_config
      ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
      : new RoomConfiguration();

    if (!roomConfig.agents?.length && AGENT_NAME) {
      roomConfig = RoomConfiguration.fromJson(
        { agents: [{ agent_name: AGENT_NAME }] },
        { ignoreUnknownFields: true }
      );
    }

    const participantName = 'user';
    const participantIdentity = `code_agent_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `code_agent_room_${Math.floor(Math.random() * 10_000)}`;

    const attributes: Record<string, string> = {};
    if (workspacePath) {
      attributes.workspace_path = workspacePath;
    }
    attributes.cursor_runtime = process.env.CURSOR_RUNTIME ?? 'local';

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig,
      attributes
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse('Unknown error', { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration,
  attributes: Record<string, string>
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
    attributes,
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  at.roomConfig = roomConfig;
  return at.toJwt();
}
