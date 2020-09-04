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
import { http } from '@awesomeorganization/servers'
import { staticHandler } from '@awesomeorganization/static-handler'

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
```
