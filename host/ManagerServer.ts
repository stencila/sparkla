import { TcpServerClient, WebSocketAddress, WebSocketServer } from '@stencila/executa';
import { FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from 'fastify-static';
import path from 'path';
import { Manager } from './Manager';

/**
 * A WebSocket server for `Manager`
 *
 * Extends the standard `executa.WebSocketServer` with
 * custom handlers and endpoints.
 */
export class ManagerServer extends WebSocketServer {
  constructor(host = '127.0.0.1', port = 9000) {
    super(new WebSocketAddress({ host, port }))

    // Register static file serving plugin
    this.app.register(fastifyStatic, {
      root: path.join(__dirname, 'public'),
      prefix: '/public/'
    })

    // Add admin page endpoint
    this.app.get('/admin', (request: FastifyRequest, reply: FastifyReply<any>): void =>  {
      if (request.headers['accept'].includes('application/json')) {
        const { sessions } = this.executor as Manager
        reply.send(sessions)
      }
      reply.sendFile('admin.html')
    })
  }

  /**
   * Handler for client disconnection.
   *
   * Override to end all sessions for the client.
   */
  async onDisconnected(client: TcpServerClient) {
    // Call `WebSockerServer.onDisconnected` to de-register the client
    // as normal
    super.onDisconnected(client)

    // Tell the `Manager` to end all sessions that are linked to
    // the client
    const manager = this.executor
    if (manager !== undefined) {
      // @ts-ignore that TS doesn't know that this is a Manager instance
      await manager.endAllClient(client.id)
    }
  }
}
