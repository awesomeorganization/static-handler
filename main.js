/* eslint-disable node/no-unsupported-features/es-syntax */

// REFERENCES
// https://tools.ietf.org/html/rfc7230#section-3
// https://tools.ietf.org/html/rfc7231#section-5.2
// https://tools.ietf.org/html/rfc7232#section-3.1
// https://tools.ietf.org/html/rfc7232#section-3.2
// https://tools.ietf.org/html/rfc7232#section-3.3
// https://tools.ietf.org/html/rfc7232#section-3.4
// https://tools.ietf.org/html/rfc7233
// https://tools.ietf.org/html/rfc7234
// https://fetch.spec.whatwg.org/
// https://blake2.net/blake2.pdf

// TODO
// https://tools.ietf.org/html/rfc7230#section-4
// https://tools.ietf.org/html/rfc7231#section-5.3

const STATUS_OK = 200
const STATUS_NO_CONTENT = 200
const STATUS_PARTIAL_CONTENT = 206
const STATUS_NOT_MODIFIED = 304
const STATUS_NOT_FOUND = 404
const STATUS_PRECONDITION_FAILED = 412
const STATUS_REQUESTED_RANGE_NOT_SATISFIABLE = 416
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
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'
const DEFAULT_DIRECTORY_PATH = '.'
const DEFAULT_USE_WEAK_ETAGS = true
const RANGE_HEADER_PREFIX = 'bytes='

export const staticHandler = async (
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
  const crypto = await import('crypto')
  const fs = await import('fs')
  const path = await import('path')
  const generateHeadersFromFile = ({ file }) => {
    return {
      'Accept-Ranges': 'bytes',
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
      const hash = crypto.createHash('blake2b512')
      fs.createReadStream(file.absolutePath, {
        emitClose: true,
      })
        .on('close', () => {
          const value = hash.read().toString('base64')
          resolve(`"${value}"`)
        })
        .pipe(hash)
    })
  }
  const notFound = ({ request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(STATUS_NOT_FOUND, {
        'Cache-Control': 'no-store',
      })
      .end()
  }
  const preconditionFailed = ({ request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(STATUS_PRECONDITION_FAILED, {
        'Cache-Control': 'no-store',
      })
      .end()
  }
  const notModified = ({ file, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_NOT_MODIFIED,
        generateHeadersFromFile({
          file,
        })
      )
      .end()
  }
  const requestedRangeNotSatisfiable = ({ request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(STATUS_REQUESTED_RANGE_NOT_SATISFIABLE, {
        'Cache-Control': 'no-store',
      })
      .end()
  }
  const partialContent = ({ boundary, content, file, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(STATUS_PARTIAL_CONTENT, {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public',
        'Content-Length': content.length,
        'Content-Type': `multipart/byteranges; boundary=${boundary}`,
        'ETag': file.eTag,
        'Last-Modified': file.lastModified,
      })
      .end(content)
  }
  const noContent = ({ file, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_NO_CONTENT,
        generateHeadersFromFile({
          file,
        })
      )
      .end()
  }
  const ok = ({ file, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response.writeHead(
      STATUS_OK,
      generateHeadersFromFile({
        file,
      })
    )
    fs.createReadStream(file.absolutePath).pipe(response)
  }
  const handle = async ({ request, response }) => {
    const pathname = request.url.includes('?') === true ? request.url.substring(0, request.url.indexOf('?')) : request.url
    const file = {
      absolutePath: path.resolve(directoryPath, pathname.substring(1)),
      contentType: contentTypeByExtensions.get(path.extname(pathname)) ?? defaultContentType,
      isExists: true,
    }
    try {
      const stats = await fs.promises.stat(file.absolutePath)
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
        request,
        response,
      })
      return
    }
    if (
      ('if-match' in request.headers === true && request.headers['if-match'] !== file.eTag) ||
      ('if-match' in request.headers === false &&
        'if-unmodified-since' in request.headers === true &&
        request.headers['if-unmodified-since'] < file.lastModified)
    ) {
      preconditionFailed({
        response,
      })
      return
    }
    if (
      ('if-none-match' in request.headers === true && request.headers['if-none-match'] === file.eTag) ||
      ('if-none-match' in request.headers === false &&
        'if-modified-since' in request.headers === true &&
        request.headers['if-modified-since'] >= file.lastModified)
    ) {
      notModified({
        file,
        response,
      })
      return
    }
    if (
      (('if-range' in request.headers === true && (request.headers['if-range'] === file.eTag || request.headers['if-range'] === file.lastModified)) ||
        'if-range' in request.headers === false) &&
      'range' in request.headers === true
    ) {
      if (request.headers.range.startsWith(RANGE_HEADER_PREFIX) === false) {
        requestedRangeNotSatisfiable({
          request,
          response,
        })
        return
      }
      const fileHandle = await fs.promises.open(file.absolutePath)
      const ranges = request.headers.range.substring(RANGE_HEADER_PREFIX.length).split(', ')
      const boundary = Math.random().toString(32).substring(2)
      const chunks = []
      for (const range of ranges) {
        let [start, end] = range.split('-')
        if (end === undefined) {
          requestedRangeNotSatisfiable({
            request,
            response,
          })
          return
        }
        if (start.length === 0) {
          if (end.length === 0) {
            requestedRangeNotSatisfiable({
              request,
              response,
            })
            return
          }
          start = file.contentLength - parseInt(end, 10)
          end = file.contentLength
        } else if (end.length === 0) {
          start = parseInt(start, 10)
          end = file.contentLength
        } else {
          start = parseInt(start, 10)
          end = parseInt(end, 10)
        }
        if (start < 0 || end < 0 || start >= end || end > file.contentLength) {
          requestedRangeNotSatisfiable({
            request,
            response,
          })
          return
        }
        const buffer = Buffer.alloc(end - start)
        fileHandle.read({
          buffer,
          position: start,
        })
        chunks.push(
          Buffer.from(`--${boundary}`),
          Buffer.from('\r\n'),
          Buffer.from(`Content-Type: ${file.contentType}`),
          Buffer.from('\r\n'),
          Buffer.from(`Content-Range: bytes ${start}-${end}/${file.contentLength}`),
          Buffer.from('\r\n'),
          Buffer.from('\r\n'),
          buffer,
          Buffer.from('\r\n')
        )
      }
      await fileHandle.close()
      chunks.push(Buffer.from(`--${boundary}--`), Buffer.from('\r\n'))
      const content = Buffer.concat(chunks)
      partialContent({
        boundary,
        content,
        file,
        request,
        response,
      })
      return
    }
    if (file.contentLength === 0) {
      noContent({
        request,
        response,
      })
      return
    }
    ok({
      file,
      request,
      response,
    })
  }
  return {
    handle,
  }
}
