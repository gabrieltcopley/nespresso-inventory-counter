import { createContext, useContext, useReducer } from 'react'
import { calcTotalCapsules } from '../lib/calculations'

const SessionContext = createContext(null)

function reducer(entries, action) {
  switch (action.type) {
    case 'ADD': {
      // Counting the same product again adds to its existing line item
      const existing = entries.findIndex(e => e.product.id === action.entry.product.id)
      if (existing === -1) return [...entries, action.entry]
      return entries.map((e, i) => {
        if (i !== existing) return e
        const fullCases = e.fullCases + action.entry.fullCases
        const looseSleeves = e.looseSleeves + action.entry.looseSleeves
        return { ...e, fullCases, looseSleeves, totalCapsules: calcTotalCapsules(e.product, fullCases, looseSleeves) }
      })
    }
    case 'UPDATE': return entries.map((e, i) => i === action.index ? { ...e, ...action.updates } : e)
    case 'REMOVE': return entries.filter((_, i) => i !== action.index)
    case 'CLEAR':  return []
    default:       return entries
  }
}

export function SessionProvider({ children }) {
  const [entries, dispatch] = useReducer(reducer, [])

  return (
    <SessionContext.Provider value={{
      entries,
      addEntry:    entry           => dispatch({ type: 'ADD', entry }),
      updateEntry: (index, updates) => dispatch({ type: 'UPDATE', index, updates }),
      removeEntry: index           => dispatch({ type: 'REMOVE', index }),
      clearSession: ()             => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </SessionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  return useContext(SessionContext)
}
