# static-handler

:boom: [ESM] The static handler for Node.js according to rfc7230, rfc7231, rfc7232, rfc7233, rfc7234 and whatwg

---

![npm](https://img.shields.io/david/awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/v/@awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/dt/@awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/l/@awesomeorganization/static-handler)
![npm](https://img.shields.io/bundlephobia/minzip/@awesomeorganization/static-handler)
![npm](https://img.shields.io/bundlephobia/min/@awesomeorganization/static-handler)

---

## Example

Full example in `/example` folder.

```
import { REDIRECT_STATUS_CODES, rewriteHandler } from '@awesomeorganization/rewrite-handler'

import { http } from '@awesomeorganization/servers'
import { staticHandler } from '@awesomeorganization/static-handler'

const example = async () => {
  const rewriteMiddleware = rewriteHandler({
    rules: [
      {
        pattern: '^/old-files/(.*)',
        replacement: '/files/$1',
        statusCode: REDIRECT_STATUS_CODES.MOVED_PERMANENTLY,
      },
      {
        pattern: '(.*)/$',
        replacement: '$1/index.txt',
      },
    ],
  })
  const staticMiddleware = await staticHandler({
    directoryPath: './static',
  })
  http({
    listenOptions: {
      host: '127.0.0.1',
      port: 3000,
    },
    onRequest(request, response) {
      rewriteMiddleware.handle({
        request,
        response,
      })
      if (response.writableEnded === true) {
        return
      }
      staticMiddleware.handle({
        request,
        response,
      })
    },
  })
  // TRY
  // http://127.0.0.1:3000/
  // http://127.0.0.1:3000/files/
  // http://127.0.0.1:3000/files/somefile.txt
  // http://127.0.0.1:3000/old-files/
  // http://127.0.0.1:3000/old-files/somefile.txt
}

example()
```
