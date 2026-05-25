/**
 * PropertyScopeToggle — Always-visible property scope picker for Cassandra.
 *
 * Renders as a compact pill in the modal header that ALWAYS shows the
 * current scope. Tapping it opens a bottom sheet where the user picks a
 * property (or "All Properties"). The tap is disabled for users with only
 * one property — but the pill itself still shows so the user always knows
 * which property Cassandra is querying.
 *
 *   ┌─ Header ────────────────────────────────────────┐
 *   │ ● Cassandra    [🏢 All Properties ⌄]      [×]   │
 *   └─────────────────────────────────────────────────┘
 *                              │
 *                              ▼ (tap)
 *   ┌─ Bottom sheet ─────────────────────────────────┐
 *   │  Pick a property                                │
 *   │  ✓ 🏢 All Properties                            │
 *   │    🏬 Mafatlal Chambers                         │
 *   │    🏬 SS Plaza                                  │
 *   │    🏬 Bajaj Kolkata                             │
 *   └─────────────────────────────────────────────────┘
 *
 * Scope value semantics (maps 1:1 to StreamChatOptions.propertyId):
 *   - `null`     → "All Properties" (backend queries every accessible property)
 *   - `string`   → "Specific property" (backend scopes to that property)
 *   - `undefined`→ "Not selected" (backend uses JWT property_id fallback)
 *
 * IMPORTANT — How the scope reaches Cassandra:
 *   The selection is NOT embedded in the JWT (the JWT is signed at login
 *   and we can't mutate it client-side). It is sent as a separate
 *   `property_id` field in the POST /chat request body, ALONGSIDE the
 *   JWT in the Authorization header. The backend:
 *     1. Verifies the JWT to identify the user.
 *     2. Reads `property_id` from the body to scope its query.
 *   See services/cassandra/chat.ts → streamChat() for the wire format.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius } from '@/constants/cassandra-theme';
import { MODAL_TOKENS, CARD_SURFACES } from '@/constants/designSystem';
import type { PropertyInfo } from '@/types/membership';

export type PropertyScope = string | null | undefined;

export interface PropertyScopeToggleProps {
  /** Properties the user has access to. */
  properties: PropertyInfo[];
  /** Currently selected scope (null = all, string = specific, undefined = JWT fallback). */
  value: PropertyScope;
  /** Called when the user picks a new scope. */
  onChange: (next: PropertyScope) => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────
const ChevronIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={Colors.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={Colors.violetLight} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12l5 5L20 7" />
  </Svg>
);

const PropertyScopeToggle: React.FC<PropertyScopeToggleProps> = ({
  properties,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);

  // Resolve the label shown on the pill.
  const currentLabel = useMemo(() => {
    if (value === null) return 'All Properties';
    if (typeof value === 'string') {
      const match = properties.find((p) => p.id === value);
      return match?.name ?? 'Selected property';
    }
    // undefined (JWT fallback) — show the first property we know about,
    // or a generic placeholder if we don't have data yet.
    return properties[0]?.name ?? 'My property';
  }, [value, properties]);

  // Multi-property users get a tappable pill. Single-property users see
  // the same pill rendered as a read-only chip — they always know which
  // property is in scope.
  const canPick = properties.length > 1;

  return (
    <>
      <TouchableOpacity
        onPress={() => canPick && setOpen(true)}
        activeOpacity={canPick ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`Property scope: ${currentLabel}${canPick ? '. Tap to change.' : ''}`}
        accessibilityState={{ disabled: !canPick }}
        style={[styles.pill, !canPick && styles.pillDisabled]}
        testID="property-scope-pill"
      >
        <Text style={styles.pillEmoji}>🏢</Text>
        <Text style={styles.pillText} numberOfLines={1}>
          {currentLabel}
        </Text>
        {canPick && <ChevronIcon />}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Pick a property</Text>
              <Text style={styles.sheetSubtitle}>
                Cassandra will scope its answers to your selection.
              </Text>
            </View>

            <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
              {/* All Properties — sends explicit `null` to the backend */}
              <TouchableOpacity
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                activeOpacity={0.7}
                style={[styles.option, value === null && styles.optionActive]}
                testID="property-scope-option-all"
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.pillEmoji}>🏢</Text>
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionTitle}>All Properties</Text>
                  <Text style={styles.optionSubtitle}>
                    Query across every property you have access to
                  </Text>
                </View>
                {value === null && <CheckIcon />}
              </TouchableOpacity>

              {properties.map((prop) => {
                const isActive = value === prop.id;
                return (
                  <TouchableOpacity
                    key={prop.id}
                    onPress={() => {
                      onChange(prop.id);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={[styles.option, isActive && styles.optionActive]}
                    testID={`property-scope-option-${prop.id}`}
                  >
                    <View style={styles.optionIcon}>
                      <Text style={styles.pillEmoji}>🏬</Text>
                    </View>
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionTitle} numberOfLines={1}>
                        {prop.name}
                      </Text>
                      {!!prop.code && (
                        <Text style={styles.optionSubtitle}>{prop.code}</Text>
                      )}
                    </View>
                    {isActive && <CheckIcon />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ─── Pill (always visible in modal header) ──────────────────────────────
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    maxWidth: 180,
  },
  pillDisabled: {
    backgroundColor: CARD_SURFACES.cardBg,
    borderColor: CARD_SURFACES.cardBorder,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },

  // ─── Bottom sheet ───────────────────────────────────────────────────────
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MODAL_TOKENS.sheetBg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderTopColor: CARD_SURFACES.cardBorder,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: CARD_SURFACES.cardBorder,
  },
  sheetTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD_SURFACES.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  optionSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default PropertyScopeToggle;
