/**
 * PropertyScopeToggle — Property scope selector for Cassandra chat
 *
 * Renders ONLY for users with 2+ properties. Lets the user tell Cassandra
 * whether to scope replies to a single property or query across all
 * accessible properties.
 *
 * Three scopes are encoded into the value:
 *   - `null`                    → "All Properties"  (backend: query across
 *                                  all properties via property_memberships)
 *   - `string` (property uuid)  → "Specific property" (backend: scope to
 *                                  that property only)
 *   - `undefined`               → "Not selected"    (backend: falls back to
 *                                  JWT property_id; useful for the first
 *                                  render before the user has touched the
 *                                  toggle)
 *
 * These three states map 1:1 to `StreamChatOptions.propertyId` so the
 * caller can pass `value` straight through to `streamChat`.
 *
 * Single-property users do not see this UI — the JWT already carries the
 * only property they can access, so there is nothing to choose.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/cassandra-theme';
import { MODAL_TOKENS, CARD_SURFACES } from '@/constants/designSystem';
import type { PropertyInfo } from '@/types/membership';

export type PropertyScope = string | null | undefined;

export interface PropertyScopeToggleProps {
  /** Properties the user has access to. Toggle hides itself if length < 2. */
  properties: PropertyInfo[];
  /** Currently selected scope (null = all, string = specific, undefined = JWT fallback). */
  value: PropertyScope;
  /** Called when the user picks a new scope. */
  onChange: (next: PropertyScope) => void;
}

const PropertyScopeToggle: React.FC<PropertyScopeToggleProps> = ({
  properties,
  value,
  onChange,
}) => {
  // Single-property (or zero-property) users don't need the toggle —
  // their JWT already carries the only property they can access.
  if (properties.length < 2) return null;

  const isAllActive = value === null;

  return (
    <View style={styles.bar} testID="property-scope-toggle">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.barContent}
      >
        {/* All Properties — sends explicit `null` to the backend */}
        <TouchableOpacity
          onPress={() => onChange(null)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Scope Cassandra to all properties"
          accessibilityState={{ selected: isAllActive }}
          style={[styles.chip, isAllActive && styles.chipActive]}
          testID="property-scope-toggle-all"
        >
          <Text style={[styles.chipText, isAllActive && styles.chipTextActive]}>
            🏢 All Properties
          </Text>
        </TouchableOpacity>

        {properties.map((prop) => {
          const isActive = value === prop.id;
          return (
            <TouchableOpacity
              key={prop.id}
              onPress={() => onChange(prop.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Scope Cassandra to ${prop.name}`}
              accessibilityState={{ selected: isActive }}
              style={[styles.chip, isActive && styles.chipActive]}
              testID={`property-scope-toggle-${prop.id}`}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {prop.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: CARD_SURFACES.cardBorder,
    backgroundColor: MODAL_TOKENS.sheetBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  barContent: {
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: CARD_SURFACES.cardBg,
    borderWidth: 1,
    borderColor: CARD_SURFACES.cardBorder,
  },
  chipActive: {
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderColor: 'rgba(139,92,246,0.5)',
  },
  chipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.violetLight,
    fontWeight: '600',
  },
});

export default PropertyScopeToggle;
