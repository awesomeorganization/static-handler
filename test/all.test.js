import { join, posix, resolve, sep, win32 } from 'path'

import { strict as assert } from 'assert'
import { promises as fs } from 'fs'
import { http } from '@awesomeorganization/servers'
import { staticHandler } from '../main.js'
import { request as undici } from 'undici'

const test = async () => {
  const directoryPath = resolve(process.argv[1], '..')
  const filename = process.argv[1].substring(process.argv[1].lastIndexOf(sep) + 1)
  const { handle, normalize } = await staticHandler({
    directoryPath,
  })
  http({
    handlers: {
      async listening() {
        const { address, port } = this.address()
        const { body } = await undici(`http://${address}:${port}/${filename}`)
        const chunks = []
        for await (const chunk of body) {
          chunks.push(chunk)
        }
        assert.deepEqual(Buffer.concat(chunks), await fs.readFile(join(directoryPath, filename)))
        this.close()
      },
      request(request, response) {
        handle({
          request,
          response,
        })
      },
    },
    listenOptions: {
      host: '127.0.0.1',
      port: 0,
    },
  })
  const testNormalize = (platform) => {
    assert.equal(normalize({ url: `${platform.sep}.` }), '/')
    assert.equal(normalize({ url: `${platform.sep}..` }), '/')
    assert.equal(normalize({ url: `${platform.sep}...` }), '/...')
    assert.equal(normalize({ url: `${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}.file` }), `/.file`)
    assert.equal(normalize({ url: `${platform.sep}..${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}..${platform.sep}..${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}..${platform.sep}dir${platform.sep}..${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}..${platform.sep}dir${platform.sep}..${platform.sep}..${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}${platform.sep}file` }), '/') // strange behaviour
    assert.equal(normalize({ url: `${platform.sep}${platform.sep}..${platform.sep}file` }), '/file')
    assert.equal(normalize({ url: `${platform.sep}${platform.sep}..${platform.sep}..${platform.sep}file` }), '/file')
  }
  testNormalize(posix)
  testNormalize(win32)
}

test()
