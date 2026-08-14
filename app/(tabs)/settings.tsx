import { Display, EmptyState, Screen } from '../../src/ui/components';

export default function SettingsScreen() {
  return (
    <Screen>
      <Display>Settings</Display>
      <EmptyState title="Nothing here yet" body="Profile and preferences will live here." />
    </Screen>
  );
}
