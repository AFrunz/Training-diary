import { useQueryClient } from '@tanstack/react-query'
import { SETTINGS_QUERY_KEY } from '../../src/ui/providers/SettingsProvider'
import { SettingsScreen } from '../../src/ui/screens/settings/SettingsScreen'

export default function SettingsTab() {
  const queryClient = useQueryClient()
  return (
    <SettingsScreen
      onSettingsChange={() => queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })}
    />
  )
}
