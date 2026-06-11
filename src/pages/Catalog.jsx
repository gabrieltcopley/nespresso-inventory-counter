import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'

const LINES = ['original', 'vertuo']
const EMPTY_FORM = { name: '', line: 'original', sku: '', capsules_per_sleeve: '', sleeves_per_case: '' }

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProduct, setNewProduct] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('line').order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.line.toLowerCase().includes(q)
  })

  function startEdit(product) {
    setEditingId(product.id)
    setEditValues({ name: product.name, line: product.line, sku: product.sku, capsules_per_sleeve: product.capsules_per_sleeve, sleeves_per_case: product.sleeves_per_case })
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
    setError('')
  }

  async function saveEdit(id) {
    if (!editValues.name || !editValues.sku || !editValues.capsules_per_sleeve || !editValues.sleeves_per_case) {
      setError('All fields are required.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('products').update({
      name: editValues.name,
      line: editValues.line,
      sku: editValues.sku,
      capsules_per_sleeve: parseInt(editValues.capsules_per_sleeve),
      sleeves_per_case: parseInt(editValues.sleeves_per_case),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (error) { setError(error.message) } else { cancelEdit(); fetchProducts() }
  }

  async function addProduct() {
    if (!newProduct.name || !newProduct.sku || !newProduct.capsules_per_sleeve || !newProduct.sleeves_per_case) {
      setError('All fields are required.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('products').insert({
      name: newProduct.name,
      line: newProduct.line,
      sku: newProduct.sku,
      capsules_per_sleeve: parseInt(newProduct.capsules_per_sleeve),
      sleeves_per_case: parseInt(newProduct.sleeves_per_case),
    })
    setSaving(false)
    if (error) { setError(error.message) } else { setNewProduct(EMPTY_FORM); setShowAddForm(false); setError(''); fetchProducts() }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Product Catalog</h1>
          <button
            onClick={() => { setShowAddForm(f => !f); setError('') }}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Flavor'}
          </button>
        </div>

        {/* Add new flavor form */}
        {showAddForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">New Flavor</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <input type="text" placeholder="Name" value={newProduct.name}
                onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                className="col-span-2 sm:col-span-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <select value={newProduct.line} onChange={e => setNewProduct(p => ({ ...p, line: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                {LINES.map(l => <option key={l} value={l}>{l === 'original' ? 'Original' : 'Vertuo'}</option>)}
              </select>
              <input type="text" placeholder="SKU" value={newProduct.sku}
                onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input type="number" placeholder="Capsules / sleeve" value={newProduct.capsules_per_sleeve}
                onChange={e => setNewProduct(p => ({ ...p, capsules_per_sleeve: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <input type="number" placeholder="Sleeves / case" value={newProduct.sleeves_per_case}
                onChange={e => setNewProduct(p => ({ ...p, sleeves_per_case: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            {error && !editingId && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={addProduct} disabled={saving}
              className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save Flavor'}
            </button>
          </div>
        )}

        {/* Search */}
        <input type="text" placeholder="Search by name, SKU, or line…" value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />

        {/* Product list */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading catalog…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {products.length === 0 ? 'No products yet. Add one above.' : 'No products match your search.'}
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
            {filtered.map(product => (
              <div key={product.id} className="px-4 py-3">
                {editingId === product.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <input value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                        placeholder="Name" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      <select value={editValues.line} onChange={e => setEditValues(v => ({ ...v, line: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                        {LINES.map(l => <option key={l} value={l}>{l === 'original' ? 'Original' : 'Vertuo'}</option>)}
                      </select>
                      <input value={editValues.sku} onChange={e => setEditValues(v => ({ ...v, sku: e.target.value }))}
                        placeholder="SKU" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      <input type="number" value={editValues.capsules_per_sleeve} onChange={e => setEditValues(v => ({ ...v, capsules_per_sleeve: e.target.value }))}
                        placeholder="Caps/sleeve" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      <input type="number" value={editValues.sleeves_per_case} onChange={e => setEditValues(v => ({ ...v, sleeves_per_case: e.target.value }))}
                        placeholder="Sleeves/case" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    </div>
                    {error && editingId === product.id && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(product.id)} disabled={saving}
                        className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-900">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="capitalize">{product.line}</span> · SKU {product.sku} · {product.capsules_per_sleeve} caps/sleeve · {product.sleeves_per_case} sleeves/case
                      </p>
                    </div>
                    <button onClick={() => startEdit(product)}
                      className="text-xs text-gray-400 hover:text-gray-900 flex-shrink-0 transition-colors">
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
