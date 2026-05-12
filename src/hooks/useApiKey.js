/**
 * Hook React useApiKey
 *
 * Récupère une clé API depuis le Coffre-fort Pilot (localStorage pilotage_vault).
 *
 * USAGE :
 *   const falKey = useApiKey('fal.ai')
 *   if (falKey) {
 *     // utiliser la clé
 *   }
 *
 * MATCH :
 *   Le hook cherche dans le Coffre-fort un compte dont le nom contient
 *   le serviceName (insensible à la casse) ET qui a une clé API renseignée.
 *
 * EXEMPLES :
 *   useApiKey('fal.ai')      → trouve "fal.ai", "Fal.ai", "Fal AI", etc.
 *   useApiKey('openai')      → trouve "OpenAI", "Open AI", "OpenAI GPT", etc.
 *   useApiKey('anthropic')   → trouve "Anthropic", "Claude Anthropic", etc.
 *   useApiKey('runpod')      → trouve "RunPod", "Runpod Studia", etc.
 *
 * RETOUR :
 *   string | null
 *   - string : la clé API trouvée
 *   - null   : aucune clé trouvée pour ce service
 *
 * NOTE :
 *   Le hook se rafraichit automatiquement quand le localStorage change
 *   (utile si l'utilisateur ajoute/modifie une clé dans le Coffre-fort
 *   pendant qu'il est dans un autre module).
 */

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'pilotage_vault'

function findApiKey(serviceName) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const comptes = JSON.parse(stored)
    if (!Array.isArray(comptes)) return null

    const needle = serviceName.toLowerCase().trim()

    // On cherche un compte dont le nom contient le serviceName ET qui a une clé API
    const found = comptes.find(c => {
      if (!c.api_key || !c.api_key.trim()) return false
      const nomLower = (c.nom || '').toLowerCase()
      return nomLower.includes(needle)
    })

    return found ? found.api_key : null
  } catch (err) {
    console.error('[useApiKey] Erreur lecture Coffre-fort:', err)
    return null
  }
}

export default function useApiKey(serviceName) {
  const [apiKey, setApiKey] = useState(() => findApiKey(serviceName))

  useEffect(() => {
    // Refresh quand le serviceName change
    setApiKey(findApiKey(serviceName))

    // Listener storage : se met à jour si le Coffre-fort change
    // (par exemple si user ajoute une clé dans le Coffre-fort
    // sans recharger Pilot)
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setApiKey(findApiKey(serviceName))
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => window.removeEventListener('storage', handleStorage)
  }, [serviceName])

  return apiKey
}

/**
 * Version multiple : récupère plusieurs clés en un seul appel.
 *
 * USAGE :
 *   const { fal, openai, anthropic } = useApiKeys(['fal.ai', 'openai', 'anthropic'])
 */
export function useApiKeys(serviceNames) {
  const [keys, setKeys] = useState(() => {
    const obj = {}
    serviceNames.forEach(name => {
      const cleanName = name.toLowerCase().replace(/\W/g, '')
      obj[cleanName] = findApiKey(name)
    })
    return obj
  })

  useEffect(() => {
    const refresh = () => {
      const obj = {}
      serviceNames.forEach(name => {
        const cleanName = name.toLowerCase().replace(/\W/g, '')
        obj[cleanName] = findApiKey(name)
      })
      setKeys(obj)
    }

    refresh()

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [serviceNames.join('|')])

  return keys
}
