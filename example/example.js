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
    handlers: {
      request(request, response) {
        rewriteMiddleware.handle({
          request,
          response,
        })
        staticMiddleware.handle({
          request,
          response,
        })
      },
    },
    listenOptions: {
      host: '127.0.0.1',
      port: 3000,
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
