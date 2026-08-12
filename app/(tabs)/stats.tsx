import { Screen } from "../../src/ui/components/Screen";
import { StatsScreen } from "../../src/ui/screens/stats/StatsScreen";

export default function StatsTab() {
  return (
    <Screen withBottomInset={false}>
      <StatsScreen />
    </Screen>
  );
}
