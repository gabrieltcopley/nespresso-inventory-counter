import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import NavBar from '../components/NavBar'

// 24x24 outline icons for the action tiles
const ICONS = {
  print: <><path d="M6 9V3h12v6" /><path d="M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" /><path d="M7 14h10v7H7z" /></>,
  download: <><path d="M12 3v12m0 0-4-4m4 4 4-4" /><path d="M4 17v3h16v-3" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
}

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const COLUMNS = [
  { key: 'sku', label: 'SKU', get: e => e.product.sku },
  { key: 'name', label: 'Flavor', get: e => e.product.name },
  { key: 'line', label: 'Line', get: e => e.product.line },
  { key: 'fullCases', label: 'Full Cases', get: e => e.fullCases, numeric: true },
  { key: 'looseSleeves', label: 'Loose Sleeves', get: e => e.looseSleeves, numeric: true },
  { key: 'totalCapsules', label: 'Total', get: e => e.totalCapsules, numeric: true },
]

// Ignores case, and compares digit runs as numbers so "0001111" sorts before "111222"
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
const compareValues = (a, b, numeric) => (numeric ? a - b : collator.compare(String(a), String(b)))

// Whatever column is chosen, ties fall back to flavor, then line, then SKU,
// so the same flavor and line always sit together
function compareEntries(a, b, sort) {
  const col = COLUMNS.find(c => c.key === sort.key)
  const primary = compareValues(col.get(a), col.get(b), col.numeric) * (sort.dir === 'asc' ? 1 : -1)
  return primary
    || compareValues(a.product.name, b.product.name)
    || compareValues(a.product.line, b.product.line)
    || compareValues(a.product.sku, b.product.sku)
}

export default function Summary() {
  const navigate = useNavigate()
  const { entries, clearSession } = useSession()
  const [notice, setNotice] = useState('')
  const { user } = useAuth()
  const [sendOpen, setSendOpen] = useState(false)
  const [recipientsText, setRecipientsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendResult, setSendResult] = useState(null)
  const [sendContent, setSendContent] = useState('summary')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const sessionDate = new Date().toLocaleString()
  const grandTotal = entries.reduce((sum, e) => sum + e.totalCapsules, 0)

  // The counting screen is a running log; here every count of the same flavor is added together
  const combinedEntries = useMemo(() => {
    const byProduct = new Map()
    for (const e of entries) {
      const row = byProduct.get(e.product.id)
      if (row) {
        row.fullCases += e.fullCases
        row.looseSleeves += e.looseSleeves
        row.totalCapsules += e.totalCapsules
      } else {
        byProduct.set(e.product.id, {
          product: e.product,
          fullCases: e.fullCases,
          looseSleeves: e.looseSleeves,
          totalCapsules: e.totalCapsules,
        })
      }
    }
    return [...byProduct.values()]
  }, [entries])

  const sortedEntries = useMemo(
    () => [...combinedEntries].sort((a, b) => compareEntries(a, b, sort)),
    [combinedEntries, sort],
  )

  function handleSort(col) {
    setSort(s => s.key === col.key
      ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      // Counts read most naturally biggest first; text reads A to Z
      : { key: col.key, dir: col.numeric ? 'desc' : 'asc' })
  }

  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-400 text-sm mb-4">No session in progress.</p>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-900 font-medium hover:underline"
          >
            Start counting
          </button>
        </div>
      </div>
    )
  }

  // One line per flavor, no column alignment: spaces only line up in a fixed-width
  // font, and mail apps use proportional ones
  function buildPlainText() {
    const lines = [
      `CoffeeCounter Inventory Count — ${sessionDate}`,
      '',
      ...sortedEntries.map(e =>
        `${e.product.name} (${e.product.line}, SKU ${e.product.sku}): ` +
        `${e.fullCases} case${e.fullCases !== 1 ? 's' : ''}, ` +
        `${e.looseSleeves} loose sleeve${e.looseSleeves !== 1 ? 's' : ''} = ${e.totalCapsules} capsules`
      ),
      '',
      `GRAND TOTAL: ${grandTotal} capsules`,
    ]
    return lines.join('\n')
  }

  // A real table, so pasting into an email keeps equal column widths
  function buildHtml() {
    const cell = 'padding:6px 12px;border:1px solid #d1d5db;'
    const th = COLUMNS.map(c =>
      `<th style="${cell}background:#f3f4f6;text-align:${c.numeric ? 'right' : 'left'};">${c.label}</th>`).join('')
    const rows = sortedEntries.map(e => `<tr>
      <td style="${cell}">${escapeHtml(e.product.sku)}</td>
      <td style="${cell}">${escapeHtml(e.product.name)}</td>
      <td style="${cell}text-transform:capitalize;">${escapeHtml(e.product.line)}</td>
      <td style="${cell}text-align:right;">${e.fullCases}</td>
      <td style="${cell}text-align:right;">${e.looseSleeves}</td>
      <td style="${cell}text-align:right;font-weight:bold;">${e.totalCapsules}</td></tr>`).join('')
    return `<p><strong>CoffeeCounter Inventory Count — ${escapeHtml(sessionDate)}</strong></p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
      <thead><tr>${th}</tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="5" style="${cell}font-weight:bold;">Grand Total</td>
      <td style="${cell}text-align:right;font-weight:bold;">${grandTotal}</td></tr></tfoot></table>`
  }

  async function copySummary() {
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({
          'text/plain': new Blob([buildPlainText()], { type: 'text/plain' }),
          'text/html': new Blob([buildHtml()], { type: 'text/html' }),
        })])
      } else {
        await navigator.clipboard.writeText(buildPlainText())
      }
      return true
    } catch {
      return false
    }
  }

  function openSend() {
    setRecipientsText(user?.email ?? '')
    setSendError('')
    setSendResult(null)
    setSendOpen(true)
  }

  async function handleSend() {
    const recipients = recipientsText.split(/[\s,;]+/).filter(Boolean)
    if (recipients.length === 0) {
      setSendError('Enter at least one email address.')
      return
    }
    setSending(true)
    setSendError('')
    const { data, error, body } = await api.post('/summary/email', {
      recipients,
      sessionDate,
      include: sendContent,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Combined rows in the order shown on screen
      entries: sortedEntries.map(e => ({ productId: e.product.id, fullCases: e.fullCases, looseSleeves: e.looseSleeves })),
      // Every entry in the order it was added
      log: entries.map(e => ({ productId: e.product.id, fullCases: e.fullCases, looseSleeves: e.looseSleeves, addedAt: e.addedAt })),
    })
    setSending(false)
    if (error) {
      // When nobody could be sent to, the server still says who was rejected and why
      if (body?.rejected?.length) setSendResult({ sent: [], rejected: body.rejected })
      else setSendError(error)
      return
    }
    setSendResult(data)
  }

  async function handleCopy() {
    setNotice((await copySummary())
      ? 'Copied. Paste it into an email or document to get a table.'
      : 'Could not copy. Use the spreadsheet download instead.')
    setTimeout(() => setNotice(''), 5000)
  }

  function handleDownloadCSV() {
    const header = 'SKU,Flavor,Line,Full Cases,Loose Sleeves,Total Capsules\n'
    const rows = sortedEntries
      .map(e => `${e.product.sku},"${e.product.name}",${e.product.line},${e.fullCases},${e.looseSleeves},${e.totalCapsules}`)
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coffeecounter-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleNewSession() {
    clearSession()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Session Summary</h1>
            <p className="text-sm text-gray-400 mt-0.5">{sessionDate}</p>
            {entries.length !== combinedEntries.length && (
              <p className="no-print text-xs text-gray-400 mt-0.5">
                {entries.length} entries combined into {combinedEntries.length} flavors. Continue Session shows each entry.
              </p>
            )}
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-white bg-gray-900 rounded-lg px-3 py-1.5 hover:bg-gray-800 transition-colors"
            >
              Continue Session
            </button>
            <button
              onClick={handleNewSession}
              className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:text-gray-900 hover:border-gray-400 transition-colors"
            >
              New Session
            </button>
          </div>
        </div>

        {/* Summary table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto print-area">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => {
                  const active = sort.key === col.key
                  return (
                    <th
                      key={col.key}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`px-4 py-1 font-semibold text-gray-600 ${col.numeric ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center gap-1 min-h-[44px] hover:text-gray-900 transition-colors ${active ? 'text-gray-900' : ''}`}
                      >
                        {col.label}
                        <span aria-hidden="true" className={`no-print text-xs ${active ? 'text-gray-900' : 'text-gray-300'}`}>
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedEntries.map(entry => (
                <tr key={entry.product.id}>
                  <td className="px-4 py-3 text-gray-500">{entry.product.sku}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.product.name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{entry.product.line}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{entry.fullCases}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{entry.looseSleeves}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{entry.totalCapsules}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700">Grand Total</td>
                <td className="px-4 py-3 text-right text-xl font-bold text-gray-900">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Export actions */}
        <div className="no-print grid grid-cols-2 gap-3">
          {[
            { icon: 'email', label: 'Email', hint: 'Send to your team', onClick: openSend },
            { icon: 'print', label: 'Print', hint: 'Print or save as PDF', onClick: () => window.print() },
            { icon: 'download', label: 'CSV', hint: 'Download as CSV', onClick: handleDownloadCSV },
            { icon: 'copy', label: 'Copy', hint: 'Paste anywhere as a table', onClick: handleCopy },
          ].map(({ icon, label, hint, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="bg-white border border-gray-200 rounded-2xl px-4 py-5 flex flex-col items-center gap-2 text-center hover:border-gray-900 hover:shadow-sm transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-gray-900" fill="none" stroke="currentColor"
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[icon]}
              </svg>
              <span className="text-sm font-semibold text-gray-900">{label}</span>
              <span className="text-xs text-gray-400">{hint}</span>
            </button>
          ))}
        </div>
        {notice && <p className="no-print text-sm text-gray-600 bg-gray-100 rounded-lg px-3 py-2">{notice}</p>}

        {/* Send as email */}
        {sendOpen && (
          <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4">
              {sendResult ? (
                <>
                  <h2 className="text-lg font-bold text-gray-900">
                    {sendResult.sent.length > 0 ? 'Email sent' : 'Nothing was sent'}
                  </h2>
                  {sendResult.sent.length > 0 && (
                    <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">
                      Sent to {sendResult.sent.join(', ')}.
                    </p>
                  )}
                  {sendResult.rejected.length > 0 && (
                    <div className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2 space-y-1">
                      <p className="font-medium">Not sent:</p>
                      {sendResult.rejected.map(r => (
                        <p key={r.email}><strong>{r.email}</strong>: {r.reason}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setSendOpen(false)}
                      className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors">
                      Done
                    </button>
                    <button onClick={() => { setSendResult(null); setRecipientsText('') }}
                      className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:border-gray-500 transition-colors">
                      Send to others
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900">Send as email</h2>
                  <label className="block text-sm text-gray-600">
                    Recipients <span className="text-gray-400">(separate with commas, up to 5)</span>
                    <textarea
                      rows={3}
                      value={recipientsText}
                      onChange={e => setRecipientsText(e.target.value)}
                      autoFocus
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="text-sm text-gray-600 mb-1">What to include</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'summary', label: 'Summary' },
                        { id: 'log', label: 'Log' },
                        { id: 'both', label: 'Both' },
                      ].map(({ id, label }) => (
                        <label
                          key={id}
                          className={`text-center text-sm font-medium rounded-lg border py-2 cursor-pointer transition-colors ${
                            sendContent === id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <input
                            type="radio"
                            name="send-content"
                            value={id}
                            checked={sendContent === id}
                            onChange={() => setSendContent(id)}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      {{
                        summary: 'Totals combined by flavor, in the order shown on this page.',
                        log: 'Every entry with the time it was added, in the order entered.',
                        both: 'The combined summary, followed by the full log.',
                      }[sendContent]}
                    </p>
                  </fieldset>
                  <p className="text-xs text-gray-400">
                    Only approved email domains can receive the summary. Replies go to {user?.email}.
                  </p>
                  {sendError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{sendError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSend} disabled={sending}
                      className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                    <button onClick={() => setSendOpen(false)} disabled={sending}
                      className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:border-gray-500 disabled:opacity-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
