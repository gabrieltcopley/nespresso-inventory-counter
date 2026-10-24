import { createContext, useContext, useReducer } from 'react'

const SessionContext = createContext(null)

// Entries are a running log: every count is its own line, in the order it was added.
// Combining the same flavor happens on the summary page.
function reducer(entries, action) {
  switch (action.type) {
    case 'ADD':    return [...entries, action.entry]
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
      // The id and timestamp are made here, not in the reducer, which must stay pure
      addEntry:    entry           => dispatch({ type: 'ADD', entry: { ...entry, id: crypto.randomUUID(), addedAt: Date.now() } }),
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
