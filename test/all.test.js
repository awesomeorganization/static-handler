import { promises as fs } from 'fs'
import { http } from '@awesomeorganization/servers'
import { ok } from 'assert'
import { staticHandler } from '../main.js'
import undici from 'undici'

const main = async () => {
  const host = '127.0.0.1'
  const port = 3000
  const { handle } = staticHandler()
  const socket = await http({
    host,
    async onRequest(request, response) {
      await handle({
        request,
        response,
      })
    },
    port,
  })
  {
    const path = '/main.js'
    const { body } = await new undici.Client(`http://${host}:${port}`).request({
      method: 'GET',
      path,
    })
    const chunks = []
    body.on('data', (chunk) => {
      chunks.push(chunk)
    })
    body.on('end', async () => {
      ok(Buffer.concat(chunks).equals(await fs.readFile('.' + path)))
    })
  }
  socket.unref()
}

main()
