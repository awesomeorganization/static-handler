# static-handler

:boom: [ESM] The static handler for Node.js according to rfc7230, rfc7231, rfc7232, rfc7233, rfc7234 and whatwg

---

![GitHub Workflow](https://img.shields.io/github/workflow/status/awesomeorganization/static-handler/npm-publish?style=flat-square)
![Codacy](https://img.shields.io/codacy/grade/76fb942875ff435c856dd6f4713feb87?style=flat-square)
![CodeFactor](https://img.shields.io/codefactor/grade/github/awesomeorganization/static-handler?style=flat-square)
![Snyk](https://img.shields.io/snyk/vulnerabilities/npm/@awesomeorganization/static-handler?style=flat-square)
![Depfu](https://img.shields.io/depfu/awesomeorganization/static-handler?style=flat-square)
![npms.io](https://img.shields.io/npms-io/final-score/@awesomeorganization/static-handler?style=flat-square)

---

## Install

```sh
npm install @awesomeorganization/static-handler
```

## Example

Full example in `/example` folder.

```js
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
```
