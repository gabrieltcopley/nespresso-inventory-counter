import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import NavBar from '../components/NavBar'

// Browsers and mail sites cap URL length, so long summaries are copied instead
const MAX_URL_LENGTH = 1800

export default function Summary() {
  const navigate = useNavigate()
  const { entries, clearSession } = useSession()
  const [emailMenuOpen, setEmailMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const sessionDate = new Date().toLocaleString()
  const grandTotal = entries.reduce((sum, e) => sum + e.totalCapsules, 0)

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

  function buildPlainText() {
    const lines = [
      `CoffeeCounter Inventory Count — ${sessionDate}`,
      '',
      'Flavor                   Line        SKU         Cases   Sleeves   Total',
      '-'.repeat(72),
      ...entries.map(e =>
        e.product.name.padEnd(25) +
        e.product.line.padEnd(12) +
        e.product.sku.padEnd(12) +
        String(e.fullCases).padEnd(8) +
        String(e.looseSleeves).padEnd(10) +
        e.totalCapsules
      ),
      '-'.repeat(72),
      `GRAND TOTAL: ${grandTotal} capsules`,
    ]
    return lines.join('\n')
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildPlainText())
      return true
    } catch {
      return false
    }
  }

  async function handleCopy() {
    setEmailMenuOpen(false)
    setNotice((await copySummary()) ? 'Summary copied to clipboard.' : 'Could not copy. Use Download CSV instead.')
  }

  async function handleEmail(provider) {
    setEmailMenuOpen(false)
    const subject = encodeURIComponent(`CoffeeCounter Inventory Count — ${sessionDate}`)
    let body = encodeURIComponent(buildPlainText())

    const buildUrl = body => ({
      mailto: `mailto:?subject=${subject}&body=${body}`,
      gmail: `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
      outlook: `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`,
    })[provider]

    let url = buildUrl(body)
    if (url.length > MAX_URL_LENGTH) {
      const copied = await copySummary()
      body = encodeURIComponent(copied ? 'The summary is too long to prefill. It was copied to your clipboard: paste it here.' : '')
      url = buildUrl(body)
      setNotice(copied ? 'Summary too long to prefill, so it was copied to your clipboard. Paste it into the email.' : '')
    } else {
      setNotice('')
    }

    if (provider === 'mailto') window.location.href = url
    else window.open(url, '_blank', 'noopener')
  }

  function handleDownloadCSV() {
    const header = 'Flavor,Line,SKU,Full Cases,Loose Sleeves,Total Capsules\n'
    const rows = entries
      .map(e => `"${e.product.name}",${e.product.line},${e.product.sku},${e.fullCases},${e.looseSleeves},${e.totalCapsules}`)
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Flavor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Line</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Full Cases</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Loose Sleeves</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((entry, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.product.name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{entry.product.line}</td>
                  <td className="px-4 py-3 text-gray-500">{entry.product.sku}</td>
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
        <div className="no-print flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[140px]">
            <button
              onClick={() => setEmailMenuOpen(o => !o)}
              aria-expanded={emailMenuOpen}
              className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Email Summary ▾
            </button>
            {emailMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden divide-y divide-gray-100">
                {[
                  { label: 'Default mail app', onClick: () => handleEmail('mailto') },
                  { label: 'Gmail (web)', onClick: () => handleEmail('gmail') },
                  { label: 'Outlook (web)', onClick: () => handleEmail('outlook') },
                  { label: 'Copy to clipboard', onClick: handleCopy },
                ].map(({ label, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleDownloadCSV}
            className="flex-1 min-w-[140px] bg-white border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:border-gray-400 transition-colors"
          >
            Download CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 min-w-[140px] bg-white border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:border-gray-400 transition-colors"
          >
            Print
          </button>
        </div>
        {notice && <p className="no-print text-sm text-gray-600 bg-gray-100 rounded-lg px-3 py-2">{notice}</p>}

      </div>
    </div>
  )
}
