import {
  Executor,
  WebSocketAddress,
  WebSocketConnection,
  WebSocketServer
} from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify'
import fastifyStatic from 'fastify-static'
import path from 'path'
import { Manager } from './Manager'

const log = getLogger('sparkla:manager:server')

/**
 * A WebSocket server for `Manager`
 *
 * Extends the standard `executa.WebSocketServer` with
 * custom handlers and endpoints.
 */
export class ManagerServer extends WebSocketServer {
  constructor(host = '127.0.0.1', port = 9000, jwtSecret: string | null) {
    super(
      new WebSocketAddress({ host, port }),
      jwtSecret === null ? undefined : jwtSecret
    )
  }

  /**
   * @override Overrides {@link WebSocketServer.buildApp} to add static
   * file serving and admin interface.
   */
  protected buildApp(): FastifyInstance {
    const app = super.buildApp()

    // Register static file serving plugin
    app.register(fastifyStatic, {
      root: path.join(__dirname, 'public'),
      prefix: '/public/'
    })

    // Add admin page endpoint
    app.get(
      '/admin',
      async (
        request: FastifyRequest,
        reply: FastifyReply<any>
      ): Promise<void> => {
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
          const manager = this.executor as Manager
          reply.send(await manager.info())
        } else reply.sendFile('admin.html')
      }
    )

    return app
  }

  /**
   * @override Override `HttpServer.onRequest` to
   * restrict access to `/admin` to JWTs with a `admin:true` claim.
   */
  protected async onRequest(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): Promise<void> {
    // Call `HttpServer.onRequest` to do JWT verification
    // and set the `request.user` to the JWT payload.
    await super.onRequest(request, reply)

    // Admin route (HTML and API endpoint) is only accessible if a valid JWT
    // with the `admin` claim
    const url = request.raw.url
    if (url?.startsWith('/admin')) {
      // @ts-ignore that `user` is not a property of `request`
      const user = request.user
      if (user === undefined || user.admin !== true) reply.status(403).send()
    }
  }

  /**
   * @override Override `TcpServer.onDisconnected` to also
   * end all active sessions for the client.
   */
  protected async onDisconnected(client: WebSocketConnection): Promise<void> {
    // Tell the `Manager` to end all sessions that are linked to
    // the client
    const manager = this.executor
    if (manager !== undefined) {
      // @ts-ignore that TS doesn't know that this is a Manager instance
      await manager.endClient(client.id)
    }

    // De-register the connection as normal
    super.onDisconnected(client)
  }

  /**
   * @override Override `HttpServer.start` to also print the
   * url of token enabled admin page
   */
  public async start(executor?: Executor): Promise<void> {
    await super.start(executor)

    const url = this.address.url().replace(/^ws/, 'http')
    const claims = {
      // Required to access the /admin route
      admin: true
      // Currently no limits are applied to sessions for admin users
    }
    // @ts-ignore that `jwt` is not a property of `this.app`
    const jwt = this.app.jwt.sign(claims)
    log.info(`Admin page at:\n  ${url}/admin?jwt=${jwt}`)
  }
}
