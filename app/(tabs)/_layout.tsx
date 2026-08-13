import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ColorValue } from "react-native";
import { Icon } from "../../src/ui/components/Icon";
import type { IconName } from "../../src/ui/components/Icon";
import { useT } from "../../src/ui/i18n/I18nProvider";
import { useTheme } from "../../src/ui/theme/ThemeProvider";
import { uiFont } from "../../src/ui/theme/tokens";

/** Таббар из макета: пять разделов, активный красится акцентом. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useT();

  // в макете иконки таббара — 22 px, цвет приходит от навигации вместе с активностью
  const icon = (name: IconName) => {
    const TabIcon = ({ color }: { color: ColorValue }) => (
      // навигация умеет отдавать системный цвет платформы — svg такой не принимает,
      // но тинты заданы выше строками, поэтому запасной вариант — неактивный цвет
      <Icon
        name={name}
        size={22}
        color={typeof color === "string" ? color : colors.textMuted}
      />
    );
    TabIcon.displayName = `TabIcon(${name})`;
    return TabIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: uiFont("500"),
          fontSize: 10,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.calendar"),
          tabBarButtonTestID: "tab-calendar",
          tabBarIcon: icon("calendar"),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: t("tab.workouts"),
          tabBarButtonTestID: "tab-workouts",
          tabBarIcon: icon("dumbbell"),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t("tab.library"),
          tabBarButtonTestID: "tab-library",
          tabBarIcon: icon("list"),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tab.stats"),
          tabBarButtonTestID: "tab-stats",
          tabBarIcon: icon("activity"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab.settings"),
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: icon("settings"),
        }}
      />
    </Tabs>
  );
}
