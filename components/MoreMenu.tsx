import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { ActionSheet } from './ActionSheet';
import { useTheme } from '../contexts/ThemeContext';
import { openBugReport } from '../lib/bugReport';

// The "..." button in screen headers. Holds actions available everywhere;
// for now that's reporting an issue with the current screen.
export function MoreMenu({ color }: { color?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="More options"
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={color ?? colors.primary} />
      </Pressable>
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        actions={[{ label: 'Report an issue', icon: 'bug-outline', onPress: openBugReport }]}
      />
    </>
  );
}
