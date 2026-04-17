'use client';

/**
 * Property Detail Page — Delegates to ApplePropertyDashboard component
 *
 * Route: /org/[orgId]/property/[propertyId]
 */

import React from 'react';
import ApplePropertyDashboard from '@/components/dashboard/ApplePropertyDashboard';

export default function PropertyDetailPage() {
  return <ApplePropertyDashboard />;
}
