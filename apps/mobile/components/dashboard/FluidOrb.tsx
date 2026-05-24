'use client';

/**
 * FluidOrb — Crystal energy orb with atmospheric palette
 *
 * Primary: Slate Blue-Green (#708F96) with Warm Tan/Gold accent (#AA895F).
 * Slower, calmer animation for a serene variant.
 * GPU-rendered via expo-gl — all animation on GPU via GLSL.
 */

import React from 'react';
import CrystalOrbCore from './CrystalOrbCore';

export default function FluidOrb() {
  return (
    <CrystalOrbCore
      size={70}
      primaryColor="#708F96"
      secondaryColor="#AA895F"
      speed={0.6}
      intensity={1.0}
    />
  );
}
