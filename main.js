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
const DEFAULT_USE_INDEX_PAGE = true
const DEFAULT_USE_WEAK_ETAGS = true
const RANGE_UNIT = 'bytes'
const SPACES_REGEXP = new RegExp('\\s+', 'g')
const CRLF = Buffer.from('\r\n')

export const parseRange = ({ range, size }) => {
  const rangeWithoutSpaces = range.replace(SPACES_REGEXP, '')
  const unitDividerIndex = rangeWithoutSpaces.indexOf('=')
  if (unitDividerIndex === -1) {
    return undefined
  }
  const unit = rangeWithoutSpaces.substring(0, unitDividerIndex)
  const rangePairs = rangeWithoutSpaces.substring(unitDividerIndex + 1).split(',')
  const ranges = []
  for (const rangePair of rangePairs) {
    const valuesDividerIndex = rangePair.indexOf('-')
    if (valuesDividerIndex === -1) {
      return undefined
    }
    let start = parseInt(rangePair.substring(0, valuesDividerIndex), 10)
    let end = parseInt(rangePair.substring(valuesDividerIndex + 1), 10)
    if (Number.isNaN(start) === true) {
      if (Number.isNaN(end) === true) {
        return undefined
      }
      start = size - 1 - end
      end = size - 1
    } else if (Number.isNaN(end) === true) {
      end = size - 1
    }
    if (start < 0 || end <= 0 || start >= end || end >= size) {
      return undefined
    }
    ranges.push({
      end,
      start,
    })
  }
  return {
    ranges,
    unit,
  }
}

export const staticHandler = async (
  {
    contentTypeByExtensions = DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType = DEFAULT_CONTENT_TYPE,
    directoryPath = DEFAULT_DIRECTORY_PATH,
    useIndexPage = DEFAULT_USE_INDEX_PAGE,
    useWeakETags = DEFAULT_USE_WEAK_ETAGS,
  } = {
    contentTypeByExtensions: DEFAULT_CONTENT_TYPE_BY_EXTENSIONS,
    defaultContentType: DEFAULT_CONTENT_TYPE,
    directoryPath: DEFAULT_DIRECTORY_PATH,
    useIndexPage: DEFAULT_USE_INDEX_PAGE,
    useWeakETags: DEFAULT_USE_WEAK_ETAGS,
  }
) => {
  const crypto = await import('crypto')
  const fs = await import('fs')
  const path = await import('path')
  const generateHeaders = ({
    acceptRanges = RANGE_UNIT,
    cacheControl = 'public',
    contentLength = 0,
    contentType = DEFAULT_CONTENT_TYPE,
    eTag,
    lastModified,
  }) => {
    const headers = [
      ['Accept-Ranges', acceptRanges],
      ['Cache-Control', cacheControl],
      ['Content-Length', contentLength],
      ['Content-Type', contentType],
    ]
    if (eTag !== undefined) {
      headers.push(['ETag', eTag])
    }
    if (lastModified !== undefined) {
      headers.push(['Last-Modified', lastModified])
    }
    return headers
  }
  const generateWeakETag = ({ stats: { mtime } }) => {
    const value = mtime.valueOf().toString(36)
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
      .writeHead(
        STATUS_NOT_FOUND,
        generateHeaders({
          acceptRanges: 'none',
          cacheControl: 'no-store',
        })
      )
      .end()
  }
  const preconditionFailed = ({ request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_PRECONDITION_FAILED,
        generateHeaders({
          acceptRanges: 'none',
          cacheControl: 'no-store',
        })
      )
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
      .writeHead(
        STATUS_REQUESTED_RANGE_NOT_SATISFIABLE,
        generateHeaders({
          acceptRanges: 'none',
          cacheControl: 'no-store',
        })
      )
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
  const indexPage = ({ content, eTag, lastModified, request, response }) => {
    if (request.aborted === true) {
      return
    }
    response
      .writeHead(
        STATUS_OK,
        generateHeaders({
          acceptRanges: 'none',
          contentLength: content.length,
          contentType: 'text/html',
          eTag,
          lastModified,
        })
      )
      .end(content)
  }
  const processDirectory = async ({ absoluteFilepath, relativeFilepath }) => {
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
    return {
      content,
    }
  }
  const processRange = async ({ absoluteFilepath, contentLength, contentType, request }) => {
    const options = parseRange({
      range: request.headers.range,
      size: contentLength,
    })
    if (options === undefined) {
      return undefined
    }
    const { unit, ranges } = options
    if (unit !== RANGE_UNIT) {
      return undefined
    }
    const fileHandle = await fs.promises.open(absoluteFilepath)
    const boundary = Date.now().toString(36)
    const chunks = []
    for (const { end, start } of ranges) {
      const buffer = Buffer.alloc(end - start)
      fileHandle.read({
        buffer,
        position: start,
      })
      chunks.push(
        Buffer.from(`--${boundary}`),
        CRLF,
        Buffer.from(`Content-Type: ${contentType}`),
        CRLF,
        Buffer.from(`Content-Range: bytes ${start}-${end}/${contentLength}`),
        CRLF,
        CRLF,
        buffer,
        CRLF
      )
    }
    await fileHandle.close()
    chunks.push(Buffer.from(`--${boundary}--`), CRLF)
    const content = Buffer.concat(chunks)
    return {
      boundary,
      content,
    }
  }
  const handle = async ({ request, response }) => {
    if (request.aborted === true) {
      return
    }
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
    const isDirectory = stats.isDirectory() === true
    const eTag =
      useWeakETags === true || isDirectory === true
        ? generateWeakETag({
            stats,
          })
        : await generateStrongETag({
            absoluteFilepath,
          })
    const lastModified = stats.mtime.toUTCString()
    if (isDirectory === true) {
      if (useIndexPage === false) {
        notFound({
          request,
          response,
        })
        return
      }
      const { content } = await processDirectory({
        absoluteFilepath,
        relativeFilepath,
      })
      indexPage({
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
      const { boundary, content } = options
      partialContent({
        boundary,
        content,
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
