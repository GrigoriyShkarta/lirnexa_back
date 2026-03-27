import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BoardService } from './board.service';
import { PrismaService } from '../prisma/prisma.service';
import { BoardElement, BoardSettings } from './interfaces/board-element.interface';

interface SocketUser {
  sub: string;
  email: string;
  role: string;
  name: string;
  avatar: string | null;
}

interface ActiveParticipant {
  user_id: string;
  email: string;
  name: string;
  avatar: string | null;
}

@Injectable()
@WebSocketGateway({
  namespace: 'board',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class BoardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BoardGateway.name);
  private readonly socket_user_map = new Map<string, SocketUser>();
  private readonly socket_rooms_map = new Map<string, Set<string>>();

  constructor(
    private readonly board_service: BoardService,
    private readonly jwt_service: JwtService,
    private readonly config_service: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('BoardGateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const board_id = client.handshake.query.board_id as string;
      const token = this.extract_token(client);

      if (!board_id) {
        this.logger.warn(`[WS] Connection rejected: No board_id in query`);
        client.disconnect(true);
        return;
      }

      if (!token) {
        this.logger.warn(`[WS] Connection rejected: No token provided`);
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt_service.verifyAsync<{ sub: string; email: string; role: string }>(token, {
        secret: this.config_service.get<string>('JWT_SECRET'),
      }).catch(err => {
        this.logger.error(`[WS] JWT Verification failed: ${err.message}`);
        throw err;
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, avatar: true, email: true, role: true },
      });

      if (!user) {
        client.disconnect(true);
        return;
      }

      const socket_user: SocketUser = {
        sub: user.id, email: user.email, role: user.role, name: user.name, avatar: user.avatar,
      };

      this.socket_user_map.set(client.id, socket_user);
      this.socket_rooms_map.set(client.id, new Set([board_id]));

      const room = this.room_name(board_id);
      await client.join(room);

      this.logger.log(`[WS] ✅ User ${user.name} joined board ${board_id}`);

      // Auto-sync state
      try {
        const board = await this.board_service.find_one(board_id, user.id, user.role as any);
        client.emit('elements:sync', { board_id, elements: board.elements, settings: board.settings });

        const participants = this.get_room_participants(room);
        client.emit('participants:list', { board_id, participants });

        const participant: ActiveParticipant = { 
          user_id: user.id, email: user.email, name: user.name, avatar: user.avatar 
        };
        client.to(room).emit('participant:joined', { board_id, participant });
      } catch (e) {
        this.logger.error(`[WS] Failed to load board data: ${e.message}`);
      }

    } catch (error) {
      this.logger.warn(`[WS] Connection rejected: Invalid token or user`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = this.socket_user_map.get(client.id);
    const rooms = this.socket_rooms_map.get(client.id);

    if (user && rooms) {
      for (const board_id of rooms) {
        const room = this.room_name(board_id);
        client.to(room).emit('participant:left', { user_id: user.sub, name: user.name });
      }
    }

    this.socket_user_map.delete(client.id);
    this.socket_rooms_map.delete(client.id);
  }

  @SubscribeMessage('element:update')
  async handle_element_update(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const board_id = payload.board_id || (client.handshake.query.board_id as string);
    const elements = Array.isArray(payload) ? payload : payload.elements;
    if (!board_id || !elements) return;

    try {
      await this.board_service.update_elements(board_id, elements);
      client.to(this.room_name(board_id)).emit('element:update', { board_id, elements });
    } catch (e) { this.emit_error(client, e); }
  }

  @SubscribeMessage('element:create')
  async handle_element_create(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const board_id = payload.board_id || (client.handshake.query.board_id as string);
    const element = payload.element || (Array.isArray(payload) ? payload : payload);
    if (!board_id || !element) return;

    try {
      const elements_to_create = Array.isArray(element) ? element : [element];
      for (const el of elements_to_create) { await this.board_service.create_element(board_id, el); }
      client.to(this.room_name(board_id)).emit('element:create', { board_id, element: elements_to_create });
    } catch (e) { this.emit_error(client, e); }
  }

  @SubscribeMessage('element:delete')
  async handle_element_delete(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const board_id = payload.board_id || (client.handshake.query.board_id as string);
    const ids = Array.isArray(payload) ? payload : (payload.ids || payload);
    if (!board_id || !ids) return;

    try {
      const id_list = Array.isArray(ids) ? ids : [ids];
      await this.board_service.delete_elements(board_id, id_list);
      client.to(this.room_name(board_id)).emit('element:delete', { board_id, ids: id_list });
    } catch (e) { this.emit_error(client, e); }
  }

  @SubscribeMessage('cursor:move')
  handle_cursor_move(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const user = this.socket_user_map.get(client.id);
    const board_id = payload.board_id || (client.handshake.query.board_id as string);
    if (!user || !board_id) return;

    client.to(this.room_name(board_id)).emit('cursor:move', {
      board_id, user_id: user.sub, name: user.name, avatar: user.avatar,
      x: payload.x, y: payload.y, path: payload.path
    });
  }

  @SubscribeMessage('board:settings_update')
  async handle_settings_update(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const board_id = payload.board_id || (client.handshake.query.board_id as string);
    const settings = payload.settings || (payload.board_id ? payload.settings : payload);
    if (!board_id || !settings) return;

    try {
      const updated = await this.board_service.update_settings(board_id, settings);
      this.server.to(this.room_name(board_id)).emit('board:settings_update', { board_id, settings: updated.settings });
    } catch (e) { this.emit_error(client, e); }
  }

  private room_name(board_id: string): string { return `board:${board_id}`; }

  private extract_token(client: Socket): string | undefined {
    const cookie = client.handshake.headers?.cookie;
    if (cookie) {
      const m = cookie.match(/access_token=([^;]+)/);
      if (m?.[1]) return m[1];
    }
    return client.handshake.auth?.token as string;
  }

  private get_room_participants(room: string): ActiveParticipant[] {
    const participants: ActiveParticipant[] = [];
    const room_sockets = this.server.sockets.adapter.rooms.get(room);
    if (room_sockets) {
      for (const socket_id of room_sockets) {
        const user = this.socket_user_map.get(socket_id);
        if (user) participants.push({ user_id: user.sub, email: user.email, name: user.name, avatar: user.avatar });
      }
    }
    return participants;
  }

  private emit_error(client: Socket, error: any): void {
    this.logger.error(`[WS] Error: ${error.message}`);
    client.emit('error', { message: error.message });
  }
}
