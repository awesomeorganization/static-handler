import { promises as fs } from 'fs'
import { http } from '@awesomeorganization/servers'
import { staticHandler } from '../main.js'
import { strictEqual } from 'assert'
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
    const { body } = await new undici.Client(`http://${host}:${port}`).request({
      method: 'GET',
      path: '/main.js',
    })
    const chunks = []
    body.on('data', (chunk) => {
      chunks.push(chunk)
    })
    body.on('end', async () => {
      strictEqual(
        Buffer.concat(chunks).toString('utf-8'),
        await fs.readFile('./main.js', {
          encoding: 'utf-8',
        })
      )
    })
  }
  socket.unref()
}

main()
