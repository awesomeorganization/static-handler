import { http } from '@awesomeorganization/servers'
import { staticHandler } from './main.js'

const main = async () => {
  const { handle } = staticHandler()
  await http({
    host: '127.0.0.1',
    onRequest: async (request, response) => {
      await handle({
        request,
        response,
      })
    },
    port: 3000,
  })
}

main()
