import { REDIRECT_STATUS_CODES, rewriteHandler } from '@awesomeorganization/rewrite-handler'

import { http } from '@awesomeorganization/servers'
import { staticHandler } from '@awesomeorganization/static-handler'

const main = async () => {
  const rewriteMiddleware = rewriteHandler()
  const staticMiddleware = staticHandler({
    directoryPath: './static',
  })
  rewriteMiddleware.push({
    pattern: '^/old-files/(.*)',
    replacement: '/files/$1',
    statusCode: REDIRECT_STATUS_CODES.MOVED_PERMANENTLY,
  })
  rewriteMiddleware.push({
    pattern: '(.*)/$',
    replacement: '$1/index.txt',
  })
  await http({
    host: '127.0.0.1',
    async onRequest(request, response) {
      rewriteMiddleware.handle({
        request,
        response,
      })
      await staticMiddleware.handle({
        request,
        response,
      })
    },
    port: 3000,
  })
  // TRY
  // http://127.0.0.1:3000/
  // http://127.0.0.1:3000/files/
  // http://127.0.0.1:3000/files/somefile.txt
  // http://127.0.0.1:3000/old-files/
  // http://127.0.0.1:3000/old-files/somefile.txt
}

main()
