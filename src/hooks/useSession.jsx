import { createContext, useContext, useReducer } from 'react'

const SessionContext = createContext(null)

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
      addEntry:    entry           => dispatch({ type: 'ADD', entry }),
      updateEntry: (index, updates) => dispatch({ type: 'UPDATE', index, updates }),
      removeEntry: index           => dispatch({ type: 'REMOVE', index }),
      clearSession: ()             => dispatch({ type: 'CLEAR' }),
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
