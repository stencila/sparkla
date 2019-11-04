import {
  TcpServerClient,
  WebSocketAddress,
  WebSocketServer
} from '@stencila/executa'
import { FastifyReply, FastifyRequest } from 'fastify'
import fastifyStatic from 'fastify-static'
import path from 'path'
import { Manager } from './Manager'

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
    this.app.get(
      '/admin',
      (request: FastifyRequest, reply: FastifyReply<any>): void => {
        // @ts-ignore that user does not exist on request
        const user = request.user

        if (
          process.env.NODE_ENV !== 'development' &&
          (user === undefined || user.admin !== true)
        ) {
          reply.status(403).send('User is not admin')
          return
        }

        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (request.headers.accept.includes('application/json')) {
          const { sessions } = this.executor as Manager
          reply.send(sessions)
        } else reply.sendFile('admin.html')
      }
    )
  }

  protected async jwtValidate(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): Promise<void> {
    if (request.raw.url !== undefined && request.raw.url.startsWith('/public/'))
      return // allow downloading from public URLs (static files) without JWT

    if (request.query.JWT_OVERRIDE !== undefined) {
      request.headers.authorization = `Bearer ${request.query.JWT_OVERRIDE}`
    }
    super.jwtValidate(request, reply)
  }

  /**
   * Handler for client disconnection.
   *
   * Override to end all sessions for the client.
   */
  async onDisconnected(client: TcpServerClient): Promise<void> {
    // Call `WebSocketServer.onDisconnected` to de-register the client
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
