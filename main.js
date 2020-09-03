import { resolve as getAbsolutePath, extname as getExtension, sep as separator } from 'path'
import { stat as getStats, opendir as openDirectory } from 'fs/promises'

import { STATUS_CODES } from 'http'
import { createReadStream } from 'fs'

// REFERENCES
// https://tools.ietf.org/html/rfc7232#section-3.3
// https://tools.ietf.org/html/rfc7234
// https://fetch.spec.whatwg.org/

const STATUS_OK = 200
const STATUS_NOT_MODIFIED = 304
const STATUS_NOT_FOUND = 404
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

const scanDirectory = async ({ contentTypeByExtensions, defaultContentType, directoryPath, filesByPathname, route }) => {
  const directory = await openDirectory(directoryPath)
  for await (const entity of directory) {
    const entityPath = directoryPath + separator + entity.name
    if (entity.isFile() === true) {
      filesByPathname.set(route + entity.name, {
        absolutePath: entityPath,
        contentType: contentTypeByExtensions.get(getExtension(entity.name)) ?? defaultContentType,
      })
      continue
    }
    if (entity.isDirectory() === true) {
      await scanDirectory({
        contentTypeByExtensions,
        defaultContentType,
        directoryPath: entityPath,
        filesByPathname,
        route: route + entity.name + '/',
      })
      continue
    }
  }
}

export const staticHandler = async (
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
  const filesByPathname = new Map()
  const scanDirectoryOptions = {
    contentTypeByExtensions,
    defaultContentType,
    directoryPath,
    filesByPathname,
    route: '/',
  }
  await scanDirectory(scanDirectoryOptions)
  return {
    async handle({ request: { headers, url }, response }) {
      const pathnameIndexEnd = url.indexOf('?')
      const pathname = pathnameIndexEnd === -1 ? url : url.substring(0, pathnameIndexEnd)
      const file = filesByPathname.get(pathnameAliases.get(pathname) ?? pathname)
      if (file === undefined) {
        response
          .writeHead(STATUS_NOT_FOUND, STATUS_CODES[STATUS_NOT_FOUND], {
            'Cache-Control': 'no-store',
          })
          .end()
      } else {
        const { absolutePath, contentType } = file
        const { mtime: lastModified, size: contentLength } = await getStats(absolutePath)
        const responseHeaders = {
          'Cache-Control': 'public',
          'Content-Length': contentLength,
          'Content-Type': contentType,
          'Last-Modified': lastModified.toUTCString(),
        }
        const lastModifiedInUnixTime = lastModified.valueOf() - (lastModified.valueOf() % 1000)
        if ('if-modified-since' in headers === true && Date.parse(headers['if-modified-since']) >= lastModifiedInUnixTime) {
          response.writeHead(STATUS_NOT_MODIFIED, STATUS_CODES[STATUS_NOT_MODIFIED], responseHeaders).end()
        } else {
          response.writeHead(STATUS_OK, STATUS_CODES[STATUS_OK], responseHeaders)
          createReadStream(absolutePath, {
            encoding: 'binary',
          }).pipe(response)
        }
      }
    },
    rescanDirectory() {
      filesByPathname.clear()
      return scanDirectory(scanDirectoryOptions)
    },
  }
}
