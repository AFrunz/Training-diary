import { useQueryClient } from '@tanstack/react-query'
import { SettingsScreen } from '../../src/ui/screens/settings/SettingsScreen'

export default function SettingsTab() {
  const queryClient = useQueryClient()

  return (
    <SettingsScreen
      // единицы веса и первый день недели участвуют в расчётах на всех экранах,
      // а кэш живёт вечно (staleTime: Infinity) — после правки настроек сбрасываем весь кэш,
      // иначе открытая тренировка останется в старых единицах
      onSettingsChange={() => queryClient.invalidateQueries()}
    />
  )
}
