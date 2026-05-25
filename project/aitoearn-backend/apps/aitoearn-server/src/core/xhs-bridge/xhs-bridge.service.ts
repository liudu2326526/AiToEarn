import type { RawData, WebSocket } from 'ws'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { WebSocketServer } from 'ws'
import { XhsBridgeHub } from './xhs-bridge-hub'

const XHS_BRIDGE_PORT = 9333

@Injectable()
export class XhsBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XhsBridgeService.name)
  private readonly hub = new XhsBridgeHub()
  private server?: WebSocketServer

  onModuleInit(): void {
    this.server = new WebSocketServer({
      host: '127.0.0.1',
      port: XHS_BRIDGE_PORT,
    })

    this.server.on('connection', (socket: WebSocket) => {
      socket.on('message', (data: RawData) => {
        this.hub.handleExtensionMessage(socket, data.toString())
      })

      socket.on('close', () => {
        this.hub.disconnect(socket)
      })

      socket.on('error', (error) => {
        this.logger.warn(`XHS Bridge socket error: ${error.message}`)
        this.hub.disconnect(socket)
      })
    })

    this.server.on('listening', () => {
      this.logger.log(`AitoBee XHS Bridge listening on ws://127.0.0.1:${XHS_BRIDGE_PORT}`)
    })

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      this.logger.warn(`AitoBee XHS Bridge failed to listen on ${XHS_BRIDGE_PORT}: ${error.message}`)
    })
  }

  onModuleDestroy(): void {
    this.server?.close()
  }
}
