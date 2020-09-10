import { resolve as getAbsolutePath, extname as getExtension } from 'path'

import { STATUS_CODES } from 'http'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { stat as getStats } from 'fs/promises'
import { parse as parseURL } from 'url'

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
const DEFAULT_PATHNAME_ALIASES = new Map([['/', '/index.html']])
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
    createReadStream(file.absolutePath, {
      encoding: 'binary',
    })
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
    useWeakETags = DEFAULT_USE_WEAK_ETAGS,
  } = {
    contentTypeByExtensions: DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    directoryPath: DEFAULT_DIRECTORY_PATH,
    pathnameAliases: DEFAULT_PATHNAME_ALIASES,
    useWeakETags: DEFAULT_USE_WEAK_ETAGS,
  }
) => {
  return {
    async handle({
      request: {
        headers: {
          'if-match': ifMatch = null,
          'if-modified-since': ifModifiedSince = null,
          'if-none-match': ifNoneMatch = null,
          'if-unmodified-since': ifUnmodifiedSince = null,
        },
        url,
      },
      response,
    }) {
      const { pathname } = parseURL(url)
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
      if (file.isExists === false) {
        notFound({
          response,
        })
      } else if ((ifMatch !== null && ifMatch !== file.eTag) || (ifMatch === null && ifUnmodifiedSince !== null && ifUnmodifiedSince < file.lastModified)) {
        preconditionFailed({
          response,
        })
      } else if (
        (ifNoneMatch !== null && ifNoneMatch === file.eTag) ||
        (ifNoneMatch === null && ifModifiedSince !== null && ifModifiedSince >= file.lastModified)
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
