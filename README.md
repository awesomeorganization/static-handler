# static-handler

:boom: [ESM] The static handler for Node.js according to rfc7232, rfc7234 and whatwg

---

![npm](https://img.shields.io/david/awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/v/@awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/dt/@awesomeorganization/static-handler)
![npm](https://img.shields.io/npm/l/@awesomeorganization/static-handler)
![npm](https://img.shields.io/bundlephobia/minzip/@awesomeorganization/static-handler)
![npm](https://img.shields.io/bundlephobia/min/@awesomeorganization/static-handler)

---

## Example

```
import { httpServer } from '@awesomeorganization/servers'
import { serve } from '@awesomeorganization/static-handler'

const { listener } = await serve()

await httpServer({
  host: '127.0.0.1',
  onRequest: async (request, response) => {
    await listener({
      request,
      response,
    })
  },
  port: 3000,
})
```
