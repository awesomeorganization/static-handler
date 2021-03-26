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
  ['.aac', 'audio/aac'],
  ['.bmp', 'image/bmp'],
  ['.cjs', 'application/javascript'],
  ['.css', 'text/css'],
  ['.csv', 'text/csv'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html'],
  ['.html', 'text/html'],
  ['.ics', 'text/calendar'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript'],
  ['.json', 'application/json'],
  ['.jsonld', 'application/ld+json'],
  ['.jsx', 'application/javascript'],
  ['.md', 'text/markdown'],
  ['.mid', 'audio/midi'],
  ['.midi', 'audio/midi'],
  ['.mjs', 'application/javascript'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.mpeg', 'video/mpeg'],
  ['.oga', 'audio/ogg'],
  ['.ogv', 'video/ogg'],
  ['.ogx', 'application/ogg'],
  ['.opus', 'audio/opus'],
  ['.otf', 'font/otf'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.rtf', 'application/rtf'],
  ['.svg', 'image/svg+xml'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
  ['.toml', 'application/toml'],
  ['.ts', 'video/mp2t'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain'],
  ['.wav', 'audio/wav'],
  ['.weba', 'audio/webm'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xhtml', 'application/xhtml+xml'],
  ['.xml', 'application/xml'],
  ['.yaml', 'application/yaml'],
  ['.zip', 'application/zip'],
])
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'
const DEFAULT_DIRECTORY_PATH = '.'
const DEFAULT_USE_WEAK_ETAGS = true
const RANGE_HEADER_PREFIX = 'bytes='
const SPACES_REGEXP = new RegExp('\\s+', 'g')

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
  const generateHeaders = ({ contentLength, contentType, eTag, lastModified }) => {
    return {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public',
      'Content-Length': contentLength,
      'Content-Type': contentType,
      'ETag': eTag,
      'Last-Modified': lastModified,
    }
  }
  const generateWeakETag = ({ stats: { mtime } }) => {
    const value = mtime.valueOf().toString(32)
    return `W/"${value}"`
  }
  const generateStrongETag = ({ absoluteFilepath }) => {
    return new Promise((resolve) => {
      const hash = crypto.createHash('blake2b512')
      fs.createReadStream(absoluteFilepath, {
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
  const notModified = ({ contentLength, contentType, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_NOT_MODIFIED,
        generateHeaders({
          contentLength,
          contentType,
          eTag,
          lastModified,
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
  const partialContent = ({ boundary, content, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_PARTIAL_CONTENT,
        generateHeaders({
          contentLength: content.length,
          contentType: `multipart/byteranges; boundary=${boundary}`,
          eTag,
          lastModified,
        })
      )
      .end(content)
  }
  const noContent = ({ contentLength, contentType, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_NO_CONTENT,
        generateHeaders({
          contentLength,
          contentType,
          eTag,
          lastModified,
        })
      )
      .end()
  }
  const ok = ({ absoluteFilepath, contentLength, contentType, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response.writeHead(
      STATUS_OK,
      generateHeaders({
        contentLength,
        contentType,
        eTag,
        lastModified,
      })
    )
    fs.createReadStream(absoluteFilepath).pipe(response)
  }
  const index = ({ content, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_OK,
        generateHeaders({
          contentLength: content.length,
          contentType: 'text/html',
          eTag,
          lastModified,
        })
      )
      .end(content)
  }
  const processRange = async ({ absoluteFilepath, contentLength, contentType, request }) => {
    const rangeHeaderValue = request.headers.range.toLowerCase().replace(SPACES_REGEXP, '')
    if (rangeHeaderValue.startsWith(RANGE_HEADER_PREFIX) === false) {
      return undefined
    }
    const fileHandle = await fs.promises.open(absoluteFilepath)
    const ranges = rangeHeaderValue.substring(RANGE_HEADER_PREFIX.length).split(',')
    const boundary = Math.random().toString(32).substring(2)
    const chunks = []
    for (const range of ranges) {
      const dividerIndex = range.indexOf('-')
      if (dividerIndex === -1) {
        return undefined
      }
      let start = range.substring(0, dividerIndex)
      let end = range.substring(dividerIndex + 1)
      start = start.length === 0 ? Number.NaN : parseInt(start, 10)
      end = end.length === 0 ? Number.NaN : parseInt(end, 10)
      if (Number.isNaN(start) === true) {
        if (Number.isNaN(end) === true) {
          return undefined
        }
        start = contentLength - 1 - end
        end = contentLength - 1
      } else if (Number.isNaN(end) === true) {
        end = contentLength - 1
      }
      if (start < 0 || end <= 0 || start >= end || end >= contentLength) {
        return undefined
      }
      const buffer = Buffer.alloc(end - start)
      fileHandle.read({
        buffer,
        position: start,
      })
      chunks.push(
        Buffer.from(`--${boundary}`),
        Buffer.from('\r\n'),
        Buffer.from(`Content-Type: ${contentType}`),
        Buffer.from('\r\n'),
        Buffer.from(`Content-Range: bytes ${start}-${end}/${contentLength}`),
        Buffer.from('\r\n'),
        Buffer.from('\r\n'),
        buffer,
        Buffer.from('\r\n')
      )
    }
    await fileHandle.close()
    chunks.push(Buffer.from(`--${boundary}--`), Buffer.from('\r\n'))
    const content = Buffer.concat(chunks)
    return {
      boundary,
      content,
    }
  }
  const handle = async ({ request, response }) => {
    const dividerIndex = request.url.indexOf('?')
    const relativeFilepath = dividerIndex === -1 ? request.url : request.url.substring(0, dividerIndex)
    const absoluteFilepath = path.resolve(directoryPath, relativeFilepath.substring(1))
    let stats
    try {
      stats = await fs.promises.stat(absoluteFilepath)
      // eslint-disable-next-line no-empty
    } catch {}
    if (stats === undefined) {
      notFound({
        request,
        response,
      })
      return
    }
    const lastModified = stats.mtime.toUTCString()
    if (stats.isDirectory() === true) {
      const entities = await fs.promises.readdir(absoluteFilepath)
      const content = [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8" />',
        '</head>',
        '<body>',
        '<ul>',
        ...entities.map((entity) => {
          return `<li><a href="${relativeFilepath === '/' ? '' : relativeFilepath}/${entity}">${entity}</a></li>`
        }),
        '</ul>',
        '</body>',
        '</html>',
      ].join('')
      const eTag = generateWeakETag({
        stats,
      })
      index({
        content,
        eTag,
        lastModified,
        request,
        response,
      })
      return
    }
    const contentLength = stats.size
    const contentType = contentTypeByExtensions.get(path.extname(relativeFilepath)) ?? defaultContentType
    const eTag =
      useWeakETags === true
        ? generateWeakETag({
            stats,
          })
        : await generateStrongETag({
            absoluteFilepath,
          })
    if (
      ('if-match' in request.headers === true && request.headers['if-match'] !== eTag) ||
      ('if-match' in request.headers === false && 'if-unmodified-since' in request.headers === true && request.headers['if-unmodified-since'] < lastModified)
    ) {
      preconditionFailed({
        response,
      })
      return
    }
    if (
      ('if-none-match' in request.headers === true && request.headers['if-none-match'] === eTag) ||
      ('if-none-match' in request.headers === false && 'if-modified-since' in request.headers === true && request.headers['if-modified-since'] >= lastModified)
    ) {
      notModified({
        contentLength,
        contentType,
        eTag,
        lastModified,
        request,
        response,
      })
      return
    }
    if (
      (('if-range' in request.headers === true && (request.headers['if-range'] === eTag || request.headers['if-range'] === lastModified)) ||
        'if-range' in request.headers === false) &&
      'range' in request.headers === true
    ) {
      const options = await processRange({
        absoluteFilepath,
        contentLength,
        contentType,
        request,
      })
      if (options === undefined) {
        requestedRangeNotSatisfiable({
          request,
          response,
        })
        return
      }
      partialContent({
        ...options,
        eTag,
        lastModified,
        request,
        response,
      })
      return
    }
    if (contentLength === 0) {
      noContent({
        request,
        response,
      })
      return
    }
    ok({
      absoluteFilepath,
      contentLength,
      contentType,
      eTag,
      lastModified,
      request,
      response,
    })
  }
  return {
    handle,
  }
}
