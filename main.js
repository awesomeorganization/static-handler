import { resolve as getAbsolutePath, extname as getExtension } from 'path'

import { STATUS_CODES } from 'http'
import { createReadStream } from 'fs'
import { stat as getStats } from 'fs/promises'
import { parse } from 'url'

// REFERENCES
// https://tools.ietf.org/html/rfc7232#section-3.3
// https://tools.ietf.org/html/rfc7232#section-3.4
// https://tools.ietf.org/html/rfc7234
// https://fetch.spec.whatwg.org/

const STATUS_OK = 200
const STATUS_NOT_MODIFIED = 304
const STATUS_NOT_FOUND = 404
const STATUS_PRECONDITION_FAILED = 412
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'
const DEFAULT_DIRECTORY_PATH = getAbsolutePath('.')
const DEFAULT_CONTENT_TYPE_BY_EXTENSIONS = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript'],
  ['.json', 'application/json'],
  ['.otf', 'font/otf'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml'],
])
const DEFAULT_PATHNAME_ALIASES = new Map([['/', '/index.html']])

const preconditionFailed = ({ response }) => {
  response
    .writeHead(STATUS_PRECONDITION_FAILED, STATUS_CODES[STATUS_PRECONDITION_FAILED], {
      'Cache-Control': 'no-store',
    })
    .end()
}

const notFound = ({ response }) => {
  response
    .writeHead(STATUS_NOT_FOUND, STATUS_CODES[STATUS_NOT_FOUND], {
      'Cache-Control': 'no-store',
    })
    .end()
}

const notModified = ({ headers, response }) => {
  response.writeHead(STATUS_NOT_MODIFIED, STATUS_CODES[STATUS_NOT_MODIFIED], headers).end()
}

const ok = ({ file, headers, response }) => {
  response.writeHead(STATUS_OK, STATUS_CODES[STATUS_OK], headers)
  createReadStream(file.absolutePath, {
    encoding: 'binary',
  }).pipe(response)
}

export const staticHandler = (
  {
    contentTypeByExtensions = DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType = DEFAULT_CONTENT_TYPE,
    directoryPath = DEFAULT_DIRECTORY_PATH,
    pathnameAliases = DEFAULT_PATHNAME_ALIASES,
  } = {
    contentTypeByExtensions: DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    directoryPath: DEFAULT_DIRECTORY_PATH,
    pathnameAliases: DEFAULT_PATHNAME_ALIASES,
  }
) => {
  return {
    async handle({
      request: {
        headers: { 'if-modified-since': ifModifiedSince = null, 'if-unmodified-since': ifUnmodifiedSince = null },
        url,
      },
      response,
    }) {
      const { pathname } = parse(url)
      const pathnameAlias = pathnameAliases.get(pathname) ?? pathname
      const file = {
        absolutePath: getAbsolutePath(directoryPath, pathnameAlias.substring(1)),
        contentType: contentTypeByExtensions.get(getExtension(pathnameAlias)) ?? defaultContentType,
        isExists: true,
      }
      try {
        const stats = await getStats(file.absolutePath)
        if (stats.isFile() === false) {
          file.isExists = false
        } else {
          file.contentLength = stats.size
          file.lastModified = stats.mtime
        }
      } catch {
        file.isExists = false
      }
      if (file.isExists === false) {
        notFound({
          response,
        })
      } else {
        const lastModifiedInUnixTime = file.lastModified.valueOf() - (file.lastModified.valueOf() % 1000)
        if (ifUnmodifiedSince !== null && Date.parse(ifUnmodifiedSince) < lastModifiedInUnixTime) {
          preconditionFailed({
            response,
          })
        } else {
          const headers = {
            'Cache-Control': 'public',
            'Content-Length': file.contentLength,
            'Content-Type': file.contentType,
            'Last-Modified': file.lastModified.toUTCString(),
          }
          if (ifModifiedSince !== null && Date.parse(ifModifiedSince) >= lastModifiedInUnixTime) {
            notModified({
              headers,
              response,
            })
          } else {
            ok({
              file,
              headers,
              response,
            })
          }
        }
      }
    },
  }
}
