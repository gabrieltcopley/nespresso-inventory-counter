import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../hooks/useSession'
import { calcTotalCapsules } from '../lib/calculations'
import NavBar from '../components/NavBar'

export default function Session() {
  const navigate = useNavigate()
  const { entries, addEntry, removeEntry } = useSession()

  const [step, setStep] = useState('choose-line')
  const [selectedLine, setSelectedLine] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [fullCases, setFullCases] = useState('')
  const [looseSleeves, setLooseSleeves] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    if (!selectedLine) return
    setLoadingProducts(true)
    supabase
      .from('products')
      .select('*')
      .eq('line', selectedLine)
      .order('name')
      .then(({ data }) => {
        setProducts(data || [])
        setLoadingProducts(false)
      })
  }, [selectedLine])

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const totalCapsules = selectedProduct
    ? calcTotalCapsules(selectedProduct, fullCases, looseSleeves)
    : 0

  const grandTotal = entries.reduce((sum, e) => sum + e.totalCapsules, 0)

  function selectLine(line) {
    setSelectedLine(line)
    setSearchQuery('')
    setStep('select-flavor')
  }

  function selectProduct(product) {
    setSelectedProduct(product)
    setFullCases('')
    setLooseSleeves('')
    setStep('enter-counts')
  }

  function handleAddEntry() {
    addEntry({
      product: selectedProduct,
      fullCases: parseInt(fullCases) || 0,
      looseSleeves: parseInt(looseSleeves) || 0,
      totalCapsules,
    })
    setStep('choose-line')
    setSelectedLine(null)
    setSelectedProduct(null)
    setFullCases('')
    setLooseSleeves('')
    setSearchQuery('')
  }

  function handleBack() {
    if (step === 'enter-counts') {
      setStep('select-flavor')
    } else if (step === 'select-flavor') {
      setStep('choose-line')
      setSelectedLine(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Running session list */}
        {entries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Session — {entries.length} flavor{entries.length !== 1 ? 's' : ''} · {grandTotal} capsules
              </span>
              <button
                onClick={() => navigate('/summary')}
                className="bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                End Session
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {entries.map((entry, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.product.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.fullCases} case{entry.fullCases !== 1 ? 's' : ''} · {entry.looseSleeves} loose sleeve{entry.looseSleeves !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900">{entry.totalCapsules}</span>
                    <button
                      onClick={() => removeEntry(i)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Choose line */}
        {step === 'choose-line' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {entries.length === 0 ? 'Choose a product line to start' : 'Add another flavor'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'original', label: 'Original Line', icon: '☕' },
                { id: 'vertuo',   label: 'Vertuo',        icon: '🌀' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => selectLine(id)}
                  className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-gray-900 hover:shadow-sm transition-all"
                >
                  <div className="text-3xl mb-3">{icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Select flavor */}
        {step === 'select-flavor' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Back</button>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {selectedLine === 'original' ? 'Original Line' : 'Vertuo'} — Select Flavor
              </p>
            </div>
            <input
              type="text"
              placeholder="Search by name or SKU…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {loadingProducts ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {products.length === 0
                  ? 'No products in catalog for this line. Add some in Catalog.'
                  : 'No products match your search.'}
              </p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">SKU {product.sku}</p>
                    </div>
                    <p className="text-xs text-gray-400 flex-shrink-0 ml-4">
                      {product.capsules_per_sleeve} caps/sleeve
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Enter counts */}
        {step === 'enter-counts' && selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Back</button>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Enter Counts</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                SKU {selectedProduct.sku} · {selectedProduct.capsules_per_sleeve} caps/sleeve · {selectedProduct.sleeves_per_case} sleeves/case
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Full Cases', value: fullCases, setter: setFullCases, autoFocus: true },
                { label: 'Loose Sleeves', value: looseSleeves, setter: setLooseSleeves, autoFocus: false },
              ].map(({ label, value, setter, autoFocus }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    autoFocus={autoFocus}
                    placeholder="0"
                    className="w-full text-3xl font-bold text-gray-900 focus:outline-none bg-transparent"
                  />
                </div>
              ))}
            </div>

            <div className="bg-gray-900 text-white rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total capsules</p>
                <p className="text-4xl font-bold">{totalCapsules}</p>
              </div>
              <button
                onClick={handleAddEntry}
                className="bg-white text-gray-900 rounded-xl px-5 py-3 text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Add to session
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
