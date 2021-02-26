import { deepStrictEqual } from 'assert'
import { http } from '@awesomeorganization/servers'
import { readFile } from 'fs/promises'
import { staticHandler } from '../main.js'
import undici from 'undici'

const data = (body) => {
  return new Promise((resolve) => {
    const chunks = []
    body.on('data', (chunk) => {
      chunks.push(chunk)
    })
    body.once('end', () => {
      resolve(Buffer.concat(chunks))
    })
  })
}

const test = async () => {
  const { handle } = await staticHandler()
  http({
    listenOptions: {
      host: '127.0.0.1',
      port: 0,
    },
    async onListening() {
      const { address, port } = this.address()
      const client = new undici.Client(`http://${address}:${port}`)
      {
        const filename = 'main.js'
        const { body } = await client.request({
          method: 'GET',
          path: `/${filename}`,
        })
        deepStrictEqual(await data(body), await readFile(`./${filename}`))
      }
      this.close()
    },
    onRequest(request, response) {
      handle({
        request,
        response,
      })
    },
  })
}

test()
