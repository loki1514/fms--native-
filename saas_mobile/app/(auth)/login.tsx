import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/utils/supabase/client';
import { Colors } from '@/constants/Colors';
import { AutopilotLogo } from '@/components/ui/AutopilotLogo';
import AnimatedLogo from '@/components/shared/AnimatedLogo';

// ─── Zod schema ───────────────────────────────────────────────────────────────
const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

type AuthMode = 'signin' | 'signup';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');

  const { signIn, signUp, signOut } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ─── React Hook Form – Sign In ─────────────────────────────────────────────
  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  });

  // ─── React Hook Form – Sign Up ──────────────────────────────────────────────
  const signUpForm = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
  });

  const isSignInLoading = signInForm.formState.isSubmitting;
  const isSignUpLoading = signUpForm.formState.isSubmitting;

  // ─── Redirect helper ────────────────────────────────────────────────────────
  const resolveAndRedirect = async (authUserId: string) => {
    // 1. Fetch auth user data
    const { data: { user: authUserData } } = await supabase.auth.getUser();

    // Lovable Super Admin — email-gated redirect (before any role logic)
    if (authUserData?.email?.toLowerCase() === 'sanyog@gmail.com') {
      router.replace('/super-admin' as any);
      return;
    }


    // 2. Fetch user profile
    const { data: userProfile, error: profileError } = await (supabase
      .from('users')
      .select('id, is_master_admin')
      .eq('id', authUserId)
      .single() as unknown as Promise<{ data: { id: string; is_master_admin: boolean } | null; error: unknown }>);

    if (profileError || !userProfile) {
      throw new Error('User profile not found.');
    }

    // 4. Master admin shortcut
    if (userProfile.is_master_admin) {
      router.replace('/master' as any);
      return;
    }

    // 5. Org-level memberships
    const { data: orgMemberships } = await supabase
      .from('organization_memberships')
      .select('organization_id, role, is_active')
      .eq('user_id', userProfile.id) as { data: unknown; error: unknown };

    type OrgMembershipRow = { organization_id: string; role: string; is_active: boolean | null };
    const orgRows = (orgMemberships ?? []) as OrgMembershipRow[];

    const ORG_LEVEL_ROLES = ['org_super_admin', 'super_tenant', 'owner', 'admin', 'org_admin', 'maintenance_vendor'];
    const activeOrgMemberships = orgRows.filter(
      (m) => ORG_LEVEL_ROLES.includes(m.role) && (m.is_active === true || m.is_active === null)
    );

    if (activeOrgMemberships.length > 0) {
      const ORG_PRIORITY = ['org_super_admin', 'super_tenant', 'owner', 'admin', 'member'];
      const best = [...activeOrgMemberships].sort((a, b) => {
        const ai = ORG_PRIORITY.indexOf(a.role) === -1 ? 99 : ORG_PRIORITY.indexOf(a.role);
        const bi = ORG_PRIORITY.indexOf(b.role) === -1 ? 99 : ORG_PRIORITY.indexOf(b.role);
        return ai - bi;
      })[0];

      router.replace(`/org/${best.organization_id}` as any);
      return;
    }

    // 6. Property memberships
    const { data: propMemberships } = await supabase
      .from('property_memberships')
      .select('property_id, organization_id, role, is_active')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false }) as { data: unknown; error: unknown };

    type PropMembershipRow = { property_id: string; organization_id: string; role: string; is_active: boolean | null };
    const propRows = (propMemberships ?? []) as PropMembershipRow[];

    const activePropMemberships = propRows.filter(
      (m) => m.is_active === true || m.is_active === null
    );

    if (activePropMemberships.length === 0) {
      await signOut();
      throw new Error('Your account is not assigned to any organization or property.');
    }

    if (activePropMemberships.length === 1) {
      // Single property – go directly to that property
      const { property_id: pId, role } = activePropMemberships[0];
      const roleRouteMap: Record<string, string> = {
        property_admin: 'dashboard',
        tenant: 'tenant',
        security: 'security',
        staff: 'lovable-mst',
        mst: 'lovable-mst',
        maintenance_staff: 'lovable-mst',
        vendor: 'vendor',
      };
      // Lovable test dashboards — email-gated redirects
      const userEmail = authUserData?.email?.toLowerCase() ?? '';
      if (userEmail === 'srustikarta2022@gmail.com') {
        router.replace(`/property/${pId}/lovable-mst`);
        return;
      }
      if (userEmail === 'lohitexplores@gmail.com') {
        router.replace(`/property/${pId}/lovable-admin`);
        return;
      }

      const route = roleRouteMap[role] || 'dashboard';
      router.replace(`/property/${pId}/${route}`);
      return;
    }

    // Multiple properties – show property selection screen
    router.replace({
      pathname: '/(auth)/property-selection',
      params: {
        properties: JSON.stringify(activePropMemberships.map((m) => ({ id: m.property_id, role: m.role }))),
      },
    });
  };

  // ─── Handle Sign In ─────────────────────────────────────────────────────────
  const handleSignIn = async (values: SignInForm) => {
    setApiError('');
    setApiSuccess('');
    try {
      const { data: { user: authUser }, error: signInError } = await signIn(values.email, values.password);
      if (signInError || !authUser) throw new Error(signInError || 'Login failed');

      await resolveAndRedirect(authUser.id);
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('invalid login credentials')) {
        setApiError('Invalid email or password. Please check your credentials and try again.');
      } else if (msg.includes('email not confirmed')) {
        setApiError('Please verify your email address before signing in. Check your inbox for a verification link.');
      } else if (msg.includes('too many requests')) {
        setApiError('Too many login attempts. Please wait a few minutes before trying again.');
      } else if (msg.includes('network')) {
        setApiError('Network error. Please check your internet connection and try again.');
      } else {
        setApiError(err.message || 'Something went wrong. Please try again.');
      }
    }
  };

  // ─── Handle Sign Up ─────────────────────────────────────────────────────────
  const handleSignUp = async (values: SignUpForm) => {
    setApiError('');
    setApiSuccess('');
    try {
      const result = await signUp(values.email, values.password, values.fullName);
      if (result?.session) {
        router.replace('/onboarding' as any);
      } else if (result?.user) {
        setApiSuccess('Account created! Please check your email inbox to verify your account before logging in.');
        signUpForm.reset();
      } else {
        throw new Error('Signup failed to return user data.');
      }
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setApiError('An account with this email already exists. Try signing in instead.');
      } else if (msg.includes('too many requests')) {
        setApiError('Too many signup attempts. Please wait a few minutes before trying again.');
      } else {
        setApiError(err.message || 'Something went wrong. Please try again.');
      }
    }
  };

  // ─── Handle Google OAuth ────────────────────────────────────────────────────
  const handleGoogleAuth = () => {
    // Google OAuth requires native configuration via expo-auth-session
    // Placeholder – wire up when OAuth is configured
    setApiError('Google Sign-In is not yet configured on mobile. Please sign in with your email and password.');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: colorScheme === 'dark' ? '#000' : theme.shadowColor,
        }]}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <AnimatedLogo size="lg" />
          </View>

          {/* Heading */}
          <Text style={[styles.title, { color: theme.text }]}>
            {authMode === 'signup' ? 'Start Your Journey' : 'Welcome Back'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {authMode === 'signup'
              ? 'Create your account to get started'
              : 'Sign in to your facility management hub'}
          </Text>

          {/* Tab Switcher */}
          <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={[styles.tab, authMode === 'signin' && { backgroundColor: theme.primary }]}
              onPress={() => { setAuthMode('signin'); setApiError(''); setApiSuccess(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: authMode === 'signin' ? '#fff' : theme.textSecondary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, authMode === 'signup' && { backgroundColor: theme.primary }]}
              onPress={() => { setAuthMode('signup'); setApiError(''); setApiSuccess(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, { color: authMode === 'signup' ? '#fff' : theme.textSecondary }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* ─── Sign In Form ─── */}
          {authMode === 'signin' && (
            <View style={styles.form}>
              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <Controller
                  control={signInForm.control}
                  name="email"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="mail-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="name@company.com"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="email"
                        />
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                    <Text style={[styles.forgotLink, { color: theme.primary }]}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
                <Controller
                  control={signInForm.control}
                  name="password"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="Enter your password"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showPassword}
                          autoComplete="password"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={theme.textTertiary}
                          />
                        </TouchableOpacity>
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* API Error */}
              {apiError !== '' && (
                <View style={[styles.messageBox, { backgroundColor: theme.errorBg, borderColor: theme.errorBorder }]}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} style={{ marginRight: 8 }} />
                  <Text style={[styles.messageText, { color: theme.error }]}>{apiError}</Text>
                </View>
              )}

              {/* API Success */}
              {apiSuccess !== '' && (
                <View style={[styles.messageBox, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} style={{ marginRight: 8 }} />
                  <Text style={[styles.messageText, { color: theme.success }]}>{apiSuccess}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, {
                  backgroundColor: theme.primary,
                  opacity: isSignInLoading ? 0.6 : 1,
                }]}
                onPress={signInForm.handleSubmit(handleSignIn)}
                disabled={isSignInLoading}
                activeOpacity={0.8}
              >
                {isSignInLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.submitRow}>
                    <Text style={styles.submitText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* OAuth Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textTertiary }]}>or continue with</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Google */}
              <TouchableOpacity
                style={[styles.oauthButton, { borderColor: theme.border }]}
                onPress={handleGoogleAuth}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={[styles.oauthText, { color: theme.text }]}>Sign in with Google</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Sign Up Form ─── */}
          {authMode === 'signup' && (
            <View style={styles.form}>
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Full Name</Text>
                <Controller
                  control={signUpForm.control}
                  name="fullName"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="person-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="John Doe"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoCapitalize="words"
                          autoComplete="name"
                        />
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email</Text>
                <Controller
                  control={signUpForm.control}
                  name="email"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="mail-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="name@company.com"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="email"
                        />
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Password</Text>
                <Controller
                  control={signUpForm.control}
                  name="password"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="Min. 6 characters"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showPassword}
                          autoComplete="password-new"
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={theme.textTertiary}
                          />
                        </TouchableOpacity>
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Confirm Password</Text>
                <Controller
                  control={signUpForm.control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                    <>
                      <View style={[styles.inputWrapper, { borderColor: error ? theme.error : theme.border }]}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text }]}
                          placeholder="Re-enter your password"
                          placeholderTextColor={theme.textTertiary}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showConfirmPassword}
                          autoComplete="password-new"
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                          <Ionicons
                            name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color={theme.textTertiary}
                          />
                        </TouchableOpacity>
                      </View>
                      {error && <Text style={[styles.fieldError, { color: theme.error }]}>{error.message}</Text>}
                    </>
                  )}
                />
              </View>

              {/* API Error */}
              {apiError !== '' && (
                <View style={[styles.messageBox, { backgroundColor: theme.errorBg, borderColor: theme.errorBorder }]}>
                  <Ionicons name="alert-circle" size={16} color={theme.error} style={{ marginRight: 8 }} />
                  <Text style={[styles.messageText, { color: theme.error }]}>{apiError}</Text>
                </View>
              )}

              {/* API Success */}
              {apiSuccess !== '' && (
                <View style={[styles.messageBox, { backgroundColor: theme.successBg, borderColor: theme.successBorder }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} style={{ marginRight: 8 }} />
                  <Text style={[styles.messageText, { color: theme.success }]}>{apiSuccess}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, {
                  backgroundColor: theme.primary,
                  opacity: isSignUpLoading ? 0.6 : 1,
                }]}
                onPress={signUpForm.handleSubmit(handleSignUp)}
                disabled={isSignUpLoading}
                activeOpacity={0.8}
              >
                {isSignUpLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.submitRow}>
                    <Text style={styles.submitText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* OAuth Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <Text style={[styles.dividerText, { color: theme.textTertiary }]}>or continue with</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              {/* Google */}
              <TouchableOpacity
                style={[styles.oauthButton, { borderColor: theme.border }]}
                onPress={handleGoogleAuth}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={[styles.oauthText, { color: theme.text }]}>Sign up with Google</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            {authMode === 'signin' ? (
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Don't have an account?{' '}
                <Text
                  style={[styles.footerLink, { color: theme.primary }]}
                  onPress={() => { setAuthMode('signup'); setApiError(''); setApiSuccess(''); }}
                >
                  Sign Up
                </Text>
              </Text>
            ) : (
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Already have an account?{' '}
                <Text
                  style={[styles.footerLink, { color: theme.primary }]}
                  onPress={() => { setAuthMode('signin'); setApiError(''); setApiSuccess(''); }}
                >
                  Sign In
                </Text>
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Urbanist-Bold',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Urbanist-Regular',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Urbanist-SemiBold',
  },
  form: {
    gap: 0,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Urbanist-SemiBold',
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Urbanist-SemiBold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: 'Urbanist-Regular',
  },
  eyeButton: {
    padding: 4,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    fontFamily: 'Urbanist-Regular',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: 'Urbanist-SemiBold',
  },
  submitButton: {
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Urbanist-Bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Urbanist-SemiBold',
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  oauthText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Urbanist-SemiBold',
  },
  footer: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
  footerLink: {
    fontWeight: '700',
    fontFamily: 'Urbanist-Bold',
  },
});
