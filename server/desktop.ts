import type { ServerWebSocket, WebSocketHandler } from 'bun'
export interface DesktopSocket { target: string; upstream?: WebSocket; pending: (string | Uint8Array)[]; buffered: number; timer?: ReturnType<typeof setTimeout> }

export const desktopHandler: WebSocketHandler<DesktopSocket> = {
  open(ws: ServerWebSocket<DesktopSocket>) {
    const upstream = new WebSocket(ws.data.target, ['binary']); upstream.binaryType = 'arraybuffer'; ws.data.upstream = upstream
    ws.data.timer = setTimeout(() => { ws.close(1011, '桌面连接超时'); upstream.close() }, 10000)
    upstream.onopen = () => {
      clearTimeout(ws.data.timer)
      for (const frame of ws.data.pending) upstream.send(frame)
      ws.data.pending = []; ws.data.buffered = 0
    }
    upstream.onmessage = event => ws.send(event.data)
    upstream.onclose = () => { clearTimeout(ws.data.timer); ws.close(1000, '桌面连接已关闭') }
    upstream.onerror = () => { clearTimeout(ws.data.timer); ws.close(1011, '桌面服务不可用') }
  },
  message(ws, message) {
    if (ws.data.upstream?.readyState === WebSocket.OPEN) ws.data.upstream.send(message)
    else {
      ws.data.buffered += typeof message === 'string' ? Buffer.byteLength(message) : message.length
      if (ws.data.buffered > 1024 * 1024) { ws.close(1009, '数据过多'); return }
      ws.data.pending.push(typeof message === 'string' ? message : new Uint8Array(message))
    }
  },
  close(ws) { clearTimeout(ws.data.timer); ws.data.upstream?.close() },
  maxPayloadLength: 8 * 1024 * 1024,
}
