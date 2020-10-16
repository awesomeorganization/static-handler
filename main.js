import { createReadStream, promises } from 'fs'
import { resolve as getAbsolutePath, extname as getExtension } from 'path'

import { STATUS_CODES } from 'http'
import { createHash } from 'crypto'

const { stat: getStats } = promises // Because fs/promises causes problems in old versions of Node.js

// REFERENCES
// https://tools.ietf.org/html/rfc7230#section-3
// https://tools.ietf.org/html/rfc7231#section-5.2
// https://tools.ietf.org/html/rfc7232#section-3.1
// https://tools.ietf.org/html/rfc7232#section-3.2
// https://tools.ietf.org/html/rfc7232#section-3.3
// https://tools.ietf.org/html/rfc7232#section-3.4
// https://tools.ietf.org/html/rfc7234
// https://fetch.spec.whatwg.org/
// https://blake2.net/blake2.pdf

// TODO
// https://tools.ietf.org/html/rfc7230#section-4
// https://tools.ietf.org/html/rfc7231#section-5.3
// https://tools.ietf.org/html/rfc7233

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
const DEFAULT_USE_WEAK_ETAGS = true

const generateHeaders = ({ file }) => {
  return {
    'Cache-Control': 'public',
    'Content-Length': file.contentLength,
    'Content-Type': file.contentType,
    'ETag': file.eTag,
    'Last-Modified': file.lastModified,
  }
}

const generateWeakETag = ({ stats: { mtime } }) => {
  const value = mtime.valueOf().toString(32)
  return `W/"${value}"`
}

const generateStrongETag = ({ file }) => {
  return new Promise((resolve) => {
    const hash = createHash('blake2b512')
    createReadStream(file.absolutePath)
      .on('close', () => {
        const value = hash.read().toString('base64')
        resolve(`"${value}"`)
      })
      .pipe(hash)
  })
}

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

const notModified = ({ file, response }) => {
  response
    .writeHead(
      STATUS_NOT_MODIFIED,
      STATUS_CODES[STATUS_NOT_MODIFIED],
      generateHeaders({
        file,
      })
    )
    .end()
}

const ok = ({ file, response }) => {
  response.writeHead(
    STATUS_OK,
    STATUS_CODES[STATUS_OK],
    generateHeaders({
      file,
    })
  )
  createReadStream(file.absolutePath).pipe(response)
}

export const staticHandler = (
  {
    contentTypeByExtensions = DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType = DEFAULT_CONTENT_TYPE,
    directoryPath = DEFAULT_DIRECTORY_PATH,
    useWeakETags = DEFAULT_USE_WEAK_ETAGS,
  } = {
    contentTypeByExtensions: DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    directoryPath: DEFAULT_DIRECTORY_PATH,
    useWeakETags: DEFAULT_USE_WEAK_ETAGS,
  }
) => {
  return {
    async handle({ request, response }) {
      let isAborted = false
      request.once('aborted', () => {
        isAborted = true
      })
      const { pathname } = new URL(request.url, `protocol://${request.headers.host}`) // WTF Node.js? https://nodejs.org/api/http.html#http_message_url
      const file = {
        absolutePath: getAbsolutePath(directoryPath, pathname.substring(1)),
        contentType: contentTypeByExtensions.get(getExtension(pathname)) ?? defaultContentType,
        isExists: true,
      }
      try {
        const stats = await getStats(file.absolutePath)
        if (stats.isFile() === false) {
          file.isExists = false
        } else {
          file.contentLength = stats.size
          file.lastModified = stats.mtime.toUTCString()
          if (useWeakETags === true) {
            file.eTag = generateWeakETag({
              stats,
            })
          } else {
            file.eTag = await generateStrongETag({
              file,
            })
          }
        }
      } catch {
        file.isExists = false
      }
      if (isAborted === true) {
        return
      } else if (file.isExists === false) {
        notFound({
          response,
        })
      } else if (
        ('if-match' in request.headers === true && request.headers['if-match'] !== file.eTag) ||
        ('if-match' in request.headers === false &&
          'if-unmodified-since' in request.headers === true &&
          request.headers['if-unmodified-since'] < file.lastModified)
      ) {
        preconditionFailed({
          response,
        })
      } else if (
        ('if-none-match' in request.headers === true && request.headers['if-none-match'] === file.eTag) ||
        ('if-none-match' in request.headers === false &&
          'if-modified-since' in request.headers === true &&
          request.headers['if-modified-since'] >= file.lastModified)
      ) {
        notModified({
          file,
          response,
        })
      } else {
        ok({
          file,
          response,
        })
      }
    },
  }
}
