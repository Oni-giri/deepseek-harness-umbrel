// End-to-end smoke test for the launcher in front of dsh, run by CI against a
// running container. It plays the browser behind Umbrel's app proxy: the Host
// and Origin are the Umbrel's address, which dsh itself does not know.
//
//   node test/smoke.mjs fresh     first start: token handover, page, API, WebSocket
//   node test/smoke.mjs restart   after a container restart: the cookie from the
//                                 first run still works (dsh's state persisted)
//
// BASE (default http://127.0.0.1:8080) is the launcher; COOKIE_FILE keeps the
// session cookie between the two phases. Only Node built-ins are used.

import { readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'

const BASE = new URL(process.env.BASE ?? 'http://127.0.0.1:8080')
const COOKIE_FILE = process.env.COOKIE_FILE ?? '/tmp/dsh-smoke-cookie'
const UMBREL = 'umbrel.local:8734'
const phase = process.argv[2] ?? 'fresh'

let failures = 0
const check = (ok, what, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`)
  if (!ok) failures++
  return ok
}

function request(method, path, { cookie, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: BASE.hostname, port: BASE.port, method, path,
      headers: {
        host: UMBREL,
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json', origin: `http://${UMBREL}` } : {}),
        ...headers,
      },
    }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve({ status: res.statusCode, headers: res.headers, body: '' }) })
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error(`${method} ${path} timed out`)))
    req.end(body ? JSON.stringify(body) : undefined)
  })
}

const rpc = (cookie) => request('POST', '/api/settings/describe', {
  cookie,
  body: { type: 'client-request', rpcId: 'smoke', method: 'settings/describe', payload: { args: {} } },
})

const upgrade = (cookie) => request('GET', '/api/remote.mux', {
  cookie,
  headers: {
    origin: `http://${UMBREL}`, connection: 'Upgrade', upgrade: 'websocket',
    'sec-websocket-version': '13', 'sec-websocket-key': 'c21va2UtdGVzdC1rZXkxMg==',
  },
})

const rpcOk = (res) => { try { return JSON.parse(res.body).result?.ok === true } catch { return false } }

// The launcher answers 503 with a status page until dsh has printed its token.
async function waitForDsh() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', '/favicon.ico')
      if (res.status !== 503) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

async function pageLoads(cookie) {
  const page = await request('GET', '/', { cookie })
  check(page.status === 200 && page.body.includes('__ModuleLoader__'), 'GET / with the cookie serves the app', `status ${page.status}`)
  const asset = /href="(plugins\/[^"]+)"/.exec(page.body)?.[1]
  if (check(Boolean(asset), 'the page references plugin bundles')) {
    const res = await request('GET', `/${asset.replaceAll('&amp;', '&')}`, { cookie })
    check(res.status === 200, 'a plugin bundle loads', `status ${res.status}`)
  }
}

if (!check(await waitForDsh(), 'dsh is ready behind the launcher')) process.exit(1)

if (phase === 'fresh') {
  const entry = await request('GET', '/')
  const setCookie = [].concat(entry.headers['set-cookie'] ?? []).find((c) => c.startsWith('dsh-auth-'))
  check(entry.status === 303, 'GET / without a cookie redirects', `status ${entry.status}`)
  check(Boolean(setCookie), 'the redirect sets a dsh-auth cookie')
  check(entry.headers.location === './', 'the redirect drops the launch token', `location ${entry.headers.location}`)
  const cookie = setCookie?.split(';')[0]
  if (cookie) writeFileSync(COOKIE_FILE, cookie)

  await pageLoads(cookie)

  const anon = await rpc()
  check(anon.status === 401, 'API call without the cookie is refused', `status ${anon.status}`)
  const authed = await rpc(cookie)
  check(authed.status === 200 && rpcOk(authed), 'API call with the cookie succeeds', `status ${authed.status}`)

  const wsAnon = await upgrade()
  check(wsAnon.status === 401, 'WebSocket without the cookie is refused', `status ${wsAnon.status}`)
  const ws = await upgrade(cookie)
  check(ws.status === 101, 'WebSocket with the cookie connects', `status ${ws.status}`)
} else if (phase === 'restart') {
  const cookie = readFileSync(COOKIE_FILE, 'utf8').trim()
  await pageLoads(cookie)
  const authed = await rpc(cookie)
  check(authed.status === 200 && rpcOk(authed), 'API call with the old cookie still succeeds', `status ${authed.status}`)
} else {
  console.error(`unknown phase ${phase}`)
  process.exit(2)
}

if (failures) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
