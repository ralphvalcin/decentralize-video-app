import { useEffect } from 'react'
import { useWhiteboardStore } from '../store/useWhiteboardStore'

export function WhiteboardController() {
  useEffect(() => {
    return () => {
      useWhiteboardStore.getState().clearStrokes()
      useWhiteboardStore.setState({ grantedPeerIds: new Set() })
    }
  }, [])
  return null
}
