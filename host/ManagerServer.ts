import {
  Executor,
  WebSocketAddress,
  WebSocketConnection,
  WebSocketServer
} from '@stencila/executa'
import { getLogger } from '@stencila/logga'
import { FastifyReply, FastifyRequest } from 'fastify'
import fastifyStatic from 'fastify-static'
import path from 'path'
import { Manager } from './Manager'

const log = getLogger('sparkla:manager-server')

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
          const sessionReprs = Object.entries(sessions).reduce(
            (prev, [sessionId, sessionInfo]) => {
              const {
                node,
                user,
                clients,
                instance,
                dateStart,
                dateLast
              } = sessionInfo
              return {
                ...prev,
                ...{
                  [sessionId]: {
                    node,
                    user,
                    clients,
                    dateStart,
                    dateLast,
                    instance: instance.repr()
                  }
                }
              }
            },
            {}
          )
          reply.send(sessionReprs)
        } else reply.sendFile('admin.html')
      }
    )
  }

  /**
   * @override Override `HttpServer.onRequest` to:
   *
   *  - allow access to static files at `/public` without a JWT
   *  - restrict access to `/admin` to JWTs with a `admin:true` claim.
   */
  protected async onRequest(
    request: FastifyRequest,
    reply: FastifyReply<any>
  ): Promise<void> {
    const url = request.raw.url

    // In development do not require a JWT for any routes
    if (process.env.NODE_ENV === 'development') return

    // Anyone can access public routes, without a JWT
    if (url !== undefined && url.startsWith('/public/')) return

    // All other routes require a JWT, so call `HttpServer.onRequest`
    // to do JWT verification and set the `request.user` to the JWT payload.
    await super.onRequest(request, reply)

    // Admin route (HTML and API endpoint) is only accessible if a valid JWT
    // with the `admin` claim
    if (url !== undefined && url.startsWith('/admin')) {
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
    log.info(`Admin page at:\n  ${url}/admin?token=${jwt}`)
  }

  /**
   * @override Override `HttpServer.stop` to end all the manager's
   * sessions.
   */
  public async stop(): Promise<void> {
    const manager = this.executor
    if (manager !== undefined) {
      // @ts-ignore that TS doesn't know that this is a Manager instance
      await manager.endAll()
    }
  }
}
