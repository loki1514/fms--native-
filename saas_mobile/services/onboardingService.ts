// services/onboardingService.ts
import { serverApi } from '@/lib/serverApi';
import type { ApiResponse } from '@/services/api/client';

export const onboardingService = {
  /** Get onboarding_completed flag for current user */
  async getOnboardingStatus(): Promise<ApiResponse<{ onboarding_completed: boolean }>> {
    // Using serverApi query helper to GET /users/onboarding-status
    const res = await serverApi.query<{ onboarding_completed: boolean }>({
      table: 'users',
      action: 'select',
      select: 'onboarding_completed',
      maybeSingle: true,
    });
    // The server API is set up to map this route; if needed adjust path.
    return res;
  },

  /** Mark onboarding as completed for current user */
  async completeOnboarding(): Promise<ApiResponse<void>> {
    const res = await serverApi.query<void>({
      table: 'users',
      action: 'update',
      values: { onboarding_completed: true },
      // Assuming server route for updating user profile exists
    });
    return res;
  },
};
