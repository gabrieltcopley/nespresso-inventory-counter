import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const {
  DATABASE_URL,
  JWT_SECRET,
  RESEND_API_KEY,
  EMAIL_FROM = 'CoffeeCounter <onboarding@resend.dev>',
  APP_URL,
  PORT = 3000,
} = process.env

if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!JWT_SECRET) throw new Error('JWT_SECRET is required')

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const parseList = value => (value || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

// Domains (no @) whose addresses may sign up, plus individual addresses
const ALLOWED_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS === undefined
  ? ['nespresso.com']
  : parseList(process.env.ALLOWED_EMAIL_DOMAINS).map(d => d.replace(/^@/, ''))
const ALLOWED_EMAILS = parseList(process.env.ALLOWED_EMAILS)

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isProd && !DATABASE_URL.includes('.railway.internal') ? { rejectUnauthorized: false } : undefined,
})

const COOKIE = 'session'
const SESSION_DAYS = 7
const LINES = ['original', 'vertuo']

// ---------- helpers ----------

const isAdminEmail = email => ADMIN_EMAILS.includes(email.toLowerCase())
const isAllowedEmail = email => {
  const e = email.toLowerCase()
  return isAdminEmail(e) || ALLOWED_EMAILS.includes(e) || ALLOWED_DOMAINS.some(d => e.endsWith(`@${d}`))
}
const publicUser = u => ({ id: u.id, email: u.email, full_name: u.full_name, isAdmin: isAdminEmail(u.email) })
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex')
const baseUrl = req => APP_URL || `${req.protocol}://${req.get('host')}`

const wrap = fn => (req, res, next) => fn(req, res, next).catch(next)

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.log(`[email disabled] to=${to} subject="${subject}"\n${html}`)
    return
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  })
  if (!r.ok) console.error('Resend error', r.status, await r.text())
}

async function createToken(userId, type, hours) {
  const token = crypto.randomBytes(32).toString('hex')
  await pool.query('delete from auth_tokens where user_id = $1 and type = $2', [userId, type])
  await pool.query(
    `insert into auth_tokens (token_hash, user_id, type, expires_at)
     values ($1, $2, $3, now() + make_interval(hours => $4))`,
    [hashToken(token), userId, type, hours],
  )
  return token
}

// Consumes a token (single use). Returns the user id or null.
async function consumeToken(token, type) {
  if (typeof token !== 'string') return null
  const { rows } = await pool.query(
    'delete from auth_tokens where token_hash = $1 and type = $2 and expires_at > now() returning user_id',
    [hashToken(token), type],
  )
  return rows[0]?.user_id ?? null
}

function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` })
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  })
}

async function requireAuth(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies[COOKIE] || '', JWT_SECRET)
    const { rows } = await pool.query('select * from users where id = $1', [payload.sub])
    if (!rows[0]) throw new Error('no user')
    req.user = rows[0]
    next()
  } catch {
    res.status(401).json({ error: 'Not authenticated' })
  }
}

function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.user.email)) return res.status(403).json({ error: 'Admin only' })
  next()
}

// Naive in-memory limiter for auth endpoints (per IP, per minute)
const hits = new Map()
function rateLimit(max) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + 60_000 })
      return next()
    }
    if (++entry.count > max) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' })
    next()
  }
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k) }, 60_000).unref()

function validateProduct(b) {
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const sku = typeof b.sku === 'string' ? b.sku.trim() : ''
  const line = typeof b.line === 'string' ? b.line.toLowerCase() : ''
  const caps = Number(b.capsules_per_sleeve)
  const sleeves = Number(b.sleeves_per_case)
  if (!name || !sku) return { error: 'Name and SKU are required.' }
  if (!LINES.includes(line)) return { error: 'Line must be "original" or "vertuo".' }
  if (!Number.isInteger(caps) || caps <= 0 || !Number.isInteger(sleeves) || sleeves <= 0) {
    return { error: 'Capsules per sleeve and sleeves per case must be positive integers.' }
  }
  return { value: { name, line, sku, capsules_per_sleeve: caps, sleeves_per_case: sleeves } }
}

// ---------- app ----------

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (req, res) => res.json({ ok: true }))

// ----- auth -----

const auth = express.Router()

auth.post('/signup', rateLimit(10), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const fullName = String(req.body.full_name || '').trim()

  if (!email.includes('@')) return res.status(400).json({ error: 'Enter a valid email address.' })
  if (!isAllowedEmail(email)) return res.status(400).json({ error: 'Sign-up is not available for this email address.' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })

  const hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(
    `insert into users (email, full_name, password_hash) values ($1, $2, $3)
     on conflict (email) do nothing returning *`,
    [email, fullName, hash],
  )
  // Respond identically whether or not the account already existed (no enumeration)
  if (rows[0]) {
    const token = await createToken(rows[0].id, 'verify', 48)
    const link = `${baseUrl(req)}/api/auth/verify?token=${token}`
    await sendEmail(email, 'Confirm your account',
      `<p>Hi ${fullName || 'there'},</p><p><a href="${link}">Confirm your email</a> to activate your account.</p>`)
  }
  res.json({ ok: true })
}))

auth.get('/verify', wrap(async (req, res) => {
  const userId = await consumeToken(req.query.token, 'verify')
  if (!userId) return res.redirect('/login?verify=invalid')
  await pool.query('update users set email_verified = true where id = $1', [userId])
  res.redirect('/login?verify=ok')
}))

auth.post('/login', rateLimit(10), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const { rows } = await pool.query('select * from users where email = $1', [email])
  const user = rows[0]
  const ok = user && await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' })
  if (!user.email_verified) return res.status(403).json({ error: 'Please confirm your email before signing in.' })
  setSession(res, user.id)
  res.json({ user: publicUser(user) })
}))

auth.post('/logout', (req, res) => {
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

auth.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

auth.post('/forgot', rateLimit(5), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const { rows } = await pool.query('select * from users where email = $1', [email])
  if (rows[0]) {
    const token = await createToken(rows[0].id, 'reset', 1)
    const link = `${baseUrl(req)}/reset-password?token=${token}`
    await sendEmail(email, 'Reset your password',
      `<p><a href="${link}">Reset your password</a>. This link expires in 1 hour.</p>`)
  }
  res.json({ ok: true })
}))

auth.post('/reset', rateLimit(10), wrap(async (req, res) => {
  const password = String(req.body.password || '')
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  const userId = await consumeToken(req.body.token, 'reset')
  if (!userId) return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  const hash = await bcrypt.hash(password, 10)
  // A successful reset also proves ownership of the email
  const { rows } = await pool.query(
    'update users set password_hash = $1, email_verified = true where id = $2 returning *', [hash, userId])
  setSession(res, userId)
  res.json({ user: publicUser(rows[0]) })
}))

app.use('/api/auth', auth)

// ----- products -----

const products = express.Router()
products.use(requireAuth)

products.get('/', wrap(async (req, res) => {
  const { line } = req.query
  const { rows } = LINES.includes(line)
    ? await pool.query('select * from products where line = $1 order by name', [line])
    : await pool.query('select * from products order by line, name')
  res.json({ products: rows })
}))

products.post('/', wrap(async (req, res) => {
  const { value, error } = validateProduct(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const { rows } = await pool.query(
      `insert into products (name, line, sku, capsules_per_sleeve, sleeves_per_case)
       values ($1, $2, $3, $4, $5) returning *`,
      [value.name, value.line, value.sku, value.capsules_per_sleeve, value.sleeves_per_case])
    res.status(201).json({ product: rows[0] })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `SKU ${value.sku} already exists.` })
    throw e
  }
}))

products.put('/:id', wrap(async (req, res) => {
  const { value, error } = validateProduct(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const { rows } = await pool.query(
      `update products set name = $1, line = $2, sku = $3, capsules_per_sleeve = $4, sleeves_per_case = $5
       where id = $6 returning *`,
      [value.name, value.line, value.sku, value.capsules_per_sleeve, value.sleeves_per_case, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' })
    res.json({ product: rows[0] })
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `SKU ${value.sku} already exists.` })
    if (e.code === '22P02') return res.status(404).json({ error: 'Product not found.' })
    throw e
  }
}))

products.delete('/:id', requireAdmin, wrap(async (req, res) => {
  try {
    await pool.query('delete from products where id = $1', [req.params.id])
  } catch (e) {
    if (e.code !== '22P02') throw e
  }
  res.json({ ok: true })
}))

products.post('/import', requireAdmin, wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : []
  const overwrite = req.body.duplicateAction === 'overwrite'
  let inserted = 0
  let skipped = 0
  const errors = []

  for (const raw of rows) {
    const { value, error } = validateProduct(raw)
    if (error) { errors.push(`${raw?.sku ?? '?'}: ${error}`); continue }
    const { rowCount } = await pool.query(
      `insert into products (name, line, sku, capsules_per_sleeve, sleeves_per_case)
       values ($1, $2, $3, $4, $5)
       on conflict (sku) ${overwrite
         ? 'do update set name = excluded.name, line = excluded.line, capsules_per_sleeve = excluded.capsules_per_sleeve, sleeves_per_case = excluded.sleeves_per_case'
         : 'do nothing'}`,
      [value.name, value.line, value.sku, value.capsules_per_sleeve, value.sleeves_per_case])
    if (rowCount) inserted++; else skipped++
  }
  res.json({ inserted, skipped, errors })
}))

app.use('/api/products', products)

// ----- static frontend (production) -----

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// Express identifies error handlers by their 4-argument signature
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

// ----- start -----

await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
app.listen(PORT, () => console.log(`Listening on :${PORT}`))
