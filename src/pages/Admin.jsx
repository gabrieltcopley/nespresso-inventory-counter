import { useState } from 'react'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) return { rows: [], errors: [] }

  const firstLine = lines[0].toLowerCase().replace(/\s/g, '')
  const hasHeader = firstLine.includes('name') && firstLine.includes('sku')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows = []
  const errors = []

  dataLines.forEach((line, i) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 5) {
      errors.push(`Row ${i + 1}: expected 5 columns, got ${cols.length}`)
      return
    }
    const [name, lineVal, sku, caps, sleeves] = cols
    if (!['original', 'vertuo'].includes(lineVal.toLowerCase())) {
      errors.push(`Row ${i + 1}: line must be "original" or "vertuo" (got "${lineVal}")`)
      return
    }
    const capsNum = parseInt(caps)
    const sleevesNum = parseInt(sleeves)
    if (isNaN(capsNum) || capsNum <= 0 || isNaN(sleevesNum) || sleevesNum <= 0) {
      errors.push(`Row ${i + 1}: capsules_per_sleeve and sleeves_per_case must be positive integers`)
      return
    }
    rows.push({ name, line: lineVal.toLowerCase(), sku, capsules_per_sleeve: capsNum, sleeves_per_case: sleevesNum })
  })

  return { rows, errors }
}

export default function Admin() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [parseErrors, setParseErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [duplicateAction, setDuplicateAction] = useState('skip')

  function handlePreview() {
    const { rows, errors } = parseCSV(csvText)
    setPreview(rows)
    setParseErrors(errors)
    setImportResult(null)
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      setCsvText(text)
      const { rows, errors } = parseCSV(text)
      setPreview(rows)
      setParseErrors(errors)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview || preview.length === 0) return
    setImporting(true)
    setImportResult(null)

    let inserted = 0
    let skipped = 0
    const errors = []

    for (const row of preview) {
      if (duplicateAction === 'overwrite') {
        const { error } = await supabase.from('products').upsert(row, { onConflict: 'sku' })
        if (error) errors.push(`${row.sku}: ${error.message}`)
        else inserted++
      } else {
        const { data } = await supabase.from('products').select('id').eq('sku', row.sku).maybeSingle()
        if (data) {
          skipped++
        } else {
          const { error } = await supabase.from('products').insert(row)
          if (error) errors.push(`${row.sku}: ${error.message}`)
          else inserted++
        }
      }
    }

    setImporting(false)
    setImportResult({ inserted, skipped, errors })
    if (errors.length === 0) { setCsvText(''); setPreview(null) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>

        {/* CSV Import */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Bulk CSV Import</h2>
            <p className="text-xs text-gray-500">
              Format: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">name, line, sku, capsules_per_sleeve, sleeves_per_case</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 hover:text-gray-900 transition-colors">
              Upload .csv file
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <span className="text-xs text-gray-400">or paste CSV below</span>
          </div>

          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={6}
            placeholder={`name, line, sku, capsules_per_sleeve, sleeves_per_case\nVivalto Lungo, original, 7630002, 10, 8\nMelozio, vertuo, 7640001, 5, 10`}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />

          <button onClick={handlePreview} disabled={!csvText.trim()}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            Preview
          </button>

          {parseErrors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 space-y-1">
              {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Preview — {preview.length} row{preview.length !== 1 ? 's' : ''}
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Name', 'Line', 'SKU', 'Caps/Sleeve', 'Sleeves/Case'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-900">{row.name}</td>
                        <td className="px-3 py-2 text-gray-500 capitalize">{row.line}</td>
                        <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                        <td className="px-3 py-2 text-gray-500">{row.capsules_per_sleeve}</td>
                        <td className="px-3 py-2 text-gray-500">{row.sleeves_per_case}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Duplicate SKUs:</label>
                  <select value={duplicateAction} onChange={e => setDuplicateAction(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none">
                    <option value="skip">Skip</option>
                    <option value="overwrite">Overwrite</option>
                  </select>
                </div>
                <button onClick={handleImport} disabled={importing}
                  className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {importing ? 'Importing…' : 'Import'}
                </button>
              </div>

              {importResult && (
                <div className={`rounded-lg p-3 ${importResult.errors.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <p className={`text-sm font-medium ${importResult.errors.length > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                    {importResult.inserted} imported · {importResult.skipped} skipped
                    {importResult.errors.length > 0 && ` · ${importResult.errors.length} error${importResult.errors.length !== 1 ? 's' : ''}`}
                  </p>
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 mt-1">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User management */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">User Management</h2>
          <p className="text-sm text-gray-500">
            Manage user accounts directly in the{' '}
            <strong className="text-gray-700">Supabase dashboard</strong> under{' '}
            <em>Authentication → Users</em>. From there you can view accounts,
            check verification status, and resend confirmation emails.
          </p>
        </div>
      </div>
    </div>
  )
}
