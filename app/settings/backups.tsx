import { router } from "expo-router";
import { Screen } from "../../src/ui/components/Screen";
import { BackupsScreen } from "../../src/ui/screens/settings/BackupsScreen";

export default function BackupsRoute() {
  return (
    <Screen>
      <BackupsScreen onBack={() => router.back()} />
    </Screen>
  );
}
