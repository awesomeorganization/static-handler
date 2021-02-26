/* eslint-disable node/no-unsupported-features/es-syntax */

const test = async () => {
  const { staticHandler } = await import('../main.js')
  const { deepStrictEqual } = await import('assert')
  const { http } = await import('@awesomeorganization/servers')
  const {
    promises: { readFile },
  } = await import('fs')
  const {
    default: { Client },
  } = await import('undici')
  const { handle } = await staticHandler()
  http({
    listenOptions: {
      host: '127.0.0.1',
      port: 0,
    },
    async onListening() {
      const filename = 'main.js'
      const { address, port } = this.address()
      const { body } = await new Client(`http://${address}:${port}`).request({
        method: 'GET',
        path: `/${filename}`,
      })
      const chunks = []
      body.on('data', (chunk) => {
        chunks.push(chunk)
      })
      body.once('end', async () => {
        deepStrictEqual(Buffer.concat(chunks), await readFile(`./${filename}`))
        this.close()
      })
    },
    async onRequest(request, response) {
      await handle({
        request,
        response,
      })
    },
  })
}

test()
