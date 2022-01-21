/* eslint-disable node/no-unsupported-features/es-syntax */

import { deepStrictEqual, strictEqual } from 'assert'
import { join, resolve, sep } from 'path'

import { http } from '@awesomeorganization/servers'
import { readFile } from 'fs/promises'
import { request } from 'undici'
import { staticHandler } from '../main.js'

const test = async () => {
  const directoryPath = resolve(process.argv[1], '..')
  const filename = process.argv[1].substring(process.argv[1].lastIndexOf(sep) + 1)
  const { handle, normalize } = await staticHandler({
    directoryPath,
  })
  http({
    listenOptions: {
      host: '127.0.0.1',
      port: 0,
    },
    async onListening() {
      const { address, port } = this.address()
      const { body } = await request(`http://${address}:${port}/${filename}`)
      const chunks = []
      for await (const chunk of body) {
        chunks.push(chunk)
      }
      deepStrictEqual(Buffer.concat(chunks), await readFile(join(directoryPath, filename)))
      this.close()
    },
    onRequest(request, response) {
      handle({
        request,
        response,
      })
    },
  })
  strictEqual(normalize('file'), 'file')
  strictEqual(normalize('/file'), 'file')
  strictEqual(normalize('\\file'), 'file')
  strictEqual(normalize('../file'), 'file')
  strictEqual(normalize('..\\file'), 'file')
  strictEqual(normalize('/../file'), 'file')
  strictEqual(normalize('\\..\\file'), 'file')
  strictEqual(normalize('/../dir/../file'), 'file')
  strictEqual(normalize('\\..\\dir\\..\\file'), 'file')
  strictEqual(normalize('/../dir/../../file'), 'file')
  strictEqual(normalize('\\..\\dir\\..\\..\\file'), 'file')
  strictEqual(normalize('/../../file'), 'file')
  strictEqual(normalize('\\..\\..\\file'), 'file')
  strictEqual(normalize('//file'), 'file')
  strictEqual(normalize('\\\\file'), 'file')
}

test()
