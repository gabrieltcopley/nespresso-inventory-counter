import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import NavBar from '../components/NavBar'

export default function Summary() {
  const navigate = useNavigate()
  const { entries, clearSession } = useSession()
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
      `Nespresso Inventory Count — ${sessionDate}`,
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

  function handleEmail() {
    const subject = encodeURIComponent(`Nespresso Inventory Count — ${sessionDate}`)
    const body = encodeURIComponent(buildPlainText())
    window.location.href = `mailto:?subject=${subject}&body=${body}`
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
    a.download = `nespresso-inventory-${new Date().toISOString().split('T')[0]}.csv`
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
          <button
            onClick={handleNewSession}
            className="no-print text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:text-gray-900 hover:border-gray-400 transition-colors"
          >
            New Session
          </button>
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
          <button
            onClick={handleEmail}
            className="flex-1 min-w-[140px] bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Email Summary
          </button>
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

      </div>
    </div>
  )
}
