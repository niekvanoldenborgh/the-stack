import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import * as authApi from '../../src/lib/api/auth';
import { useAppStore } from '../../src/store/useAppStore';
import { Body, Button, Callout, Row, Screen, Small, Spacer, TextField } from '../../src/ui/components';
import { Avatar, List, ListItem, Section } from '../../src/ui/primitives';
import { Segmented } from '../../src/ui/schedule';
import { fonts, radius, spacing, typography, useTheme } from '../../src/ui/theme';

/**
 * Create account / sign in, under Settings (THEA-90 / THEA-84c). Built
 * against the THEA-97 design spec (`account-screens-spec`, Picasso) — see
 * that doc for the full rationale; deviations are called out inline.
 *
 * One route, two modes, exactly as specced (§2): a signed-out visitor sees
 * the form below (create ↔ sign in, toggled by `Segmented`); a signed-in
 * one sees the account summary + sign-out view instead (§5).
 */

const MIN_PASSWORD_LENGTH = 8; // Mirrors server/src/lib/validation.mjs — keep these two in sync.
const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'create' | 'signin';

function Chevron() {
  const { color } = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />;
}

/**
 * Screen-specific consent checkbox (design spec §3.3, option 1). Not
 * promoted to `src/ui` yet — this is the first place the app needs a
 * checkbox rather than a `Toggle`-as-switch; promote it once a second call
 * site shows up.
 */
function ConsentCheckbox({
  checked,
  onToggle,
  disabled,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={disabled ? undefined : onToggle}
      style={({ pressed }) => ({ opacity: disabled ? 0.6 : pressed ? 0.8 : 1 })}
    >
      <Row gap={spacing.sm} align="flex-start">
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.sm,
            borderWidth: 1.5,
            borderColor: checked ? color.primarySolid : color.borderStrong,
            backgroundColor: checked ? color.primarySolid : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={color.onPrimary} /> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Row>
    </Pressable>
  );
}

/** Inline `accessibilityRole="link"` text — colour + medium weight only, no
 *  underline (AGENTS.md: `textDecorationLine` renders faux-bold-adjacent on
 *  Android with a custom font family; spec §3.2 calls this out explicitly). */
function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Text accessibilityRole="link" onPress={onPress} style={[typography.body, { color: color.primary, fontFamily: fonts.medium }]}>
      {label}
    </Text>
  );
}

interface FormError {
  title: string;
  body: string;
  /** email_already_registered offers a one-tap "sign in instead" (spec §4.4). */
  offerSignIn?: boolean;
}

function mapFormError(err: unknown): FormError | null {
  if (err instanceof authApi.AuthApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return { title: "Couldn't sign you in", body: "That email or password isn't right. Try again." };
      case 'email_already_registered':
        return { title: 'That email is already registered', body: 'Sign in instead, or use a different email.', offerSignIn: true };
      case 'network_error':
        return { title: 'No connection', body: 'Check your connection and try again.' };
      // Field-level errors are surfaced inline on the field itself, not as a form Callout.
      case 'invalid_email':
      case 'invalid_password':
      case 'tos_not_accepted':
      case 'health_consent_required':
        return null;
      default:
        return { title: 'Something went wrong', body: err.message };
    }
  }
  return { title: 'Something went wrong', body: 'Please try again.' };
}

export default function AccountScreen() {
  const theme = useTheme();
  const { color } = theme;
  const router = useRouter();
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const clearSession = useAppStore((s) => s.clearSession);

  const [mode, setMode] = useState<Mode>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tosChecked, setTosChecked] = useState(false);
  const [healthChecked, setHealthChecked] = useState(false);

  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetNoticeVisible, setResetNoticeVisible] = useState(false);

  const flipMode = (next: Mode) => {
    setMode(next);
    // Email is preserved across modes (spec §2.1); password fields are not.
    setPassword('');
    setConfirmPassword('');
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(null);
    setTosChecked(false);
    setHealthChecked(false);
    setResetNoticeVisible(false);
  };

  const emailValid = EMAIL_SHAPE_RE.test(email.trim());
  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const confirmValid = mode === 'signin' || confirmPassword === password;
  const consentValid = mode === 'signin' || (tosChecked && healthChecked);
  const canSubmit = emailValid && passwordValid && confirmValid && consentValid && !submitting;

  const onEmailBlur = () => {
    if (email.trim().length === 0) return;
    setEmailError(emailValid ? undefined : 'Enter a valid email address.');
  };

  const onPasswordBlur = () => {
    if (password.length === 0) return;
    setPasswordError(passwordValid ? undefined : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  };

  const onConfirmBlur = () => {
    if (mode !== 'create' || confirmPassword.length === 0) return;
    setConfirmError(confirmValid ? undefined : "Passwords don't match.");
  };

  const handleSubmit = async () => {
    // Re-validate on submit (spec §4.1) and surface every failing field at once.
    const emailOk = emailValid;
    const passwordOk = passwordValid;
    const confirmOk = confirmValid;
    setEmailError(emailOk ? undefined : 'Enter a valid email address.');
    setPasswordError(passwordOk ? undefined : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    setConfirmError(mode === 'create' && !confirmOk ? "Passwords don't match." : undefined);
    if (!emailOk || !passwordOk || !confirmOk || !consentValid) return;

    setFormError(null);
    setSubmitting(true);
    try {
      const result =
        mode === 'create'
          ? await authApi.register({
              email: email.trim(),
              password,
              tosAccepted: tosChecked,
              healthDataConsent: healthChecked,
            })
          : await authApi.login({ email: email.trim(), password });

      setSession({
        userId: result.user.id,
        email: result.user.email,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      // The state change is the confirmation (spec §4.5) — no success screen.
      router.back();
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        if (err.code === 'invalid_email') setEmailError(err.message);
        if (err.code === 'invalid_password') setPasswordError(err.message);
      }
      setFormError(mapFormError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSignOut = async () => {
    const current = session;
    if (!current) return;
    // Best-effort revoke server-side; sign-out proceeds locally either way —
    // there is no reason a network hiccup should trap someone in a signed-in
    // state on their own device.
    try {
      await authApi.logout(current.refreshToken);
    } catch {
      // ignore — see comment above
    }
    clearSession();
  };

  const confirmSignOut = () => {
    const message =
      'Signing out keeps your data on your account. It stays on this device too, unless you also delete it.';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof confirm === 'function' && !confirm(`Sign out?\n\n${message}`)) return;
      void onSignOut();
      return;
    }
    Alert.alert('Sign out?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void onSignOut() },
    ]);
  };

  // ---------------------------------------------------------------------
  // Signed-in view (spec §5)
  // ---------------------------------------------------------------------
  if (session) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Account' }} />
        <Spacer size={spacing.md} />

        <Section title="Account">
          <Row gap={spacing.md} align="center">
            <Avatar initials={session.email.charAt(0).toUpperCase()} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontFamily: fonts.semibold }}>{session.email}</Body>
              <Small style={{ marginTop: 2 }}>Signed in</Small>
            </View>
          </Row>
        </Section>

        <Section title="Your data">
          <Body muted>Your profile and logs are backed up to your account and synced to this device.</Body>
          <Spacer size={spacing.md} />
          <List>
            <ListItem
              title="Manage data"
              detail="Export as PDF, CSV or JSON"
              meta={<Chevron />}
              onPress={() => router.push('/settings/manage-data')}
            />
            <ListItem title="Privacy" detail="How your data is stored" meta={<Chevron />} onPress={() => router.push('/settings/privacy')} />
          </List>
        </Section>

        <Spacer size={spacing.lg} />
        <Button variant="secondary" label="Sign out" onPress={confirmSignOut} />
        <Small style={{ textAlign: 'center', marginTop: spacing.sm }}>
          Signing out keeps your data on your account. It stays on this device too, unless you also delete it.
        </Small>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------
  // Signed-out view — create account / sign in (spec §2)
  // ---------------------------------------------------------------------
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Account' }} />
      <Spacer size={spacing.md} />

      <Segmented<Mode>
        value={mode}
        onChange={flipMode}
        options={[
          { value: 'create', label: 'Create account' },
          { value: 'signin', label: 'Sign in' },
        ]}
      />

      <Spacer size={spacing.lg} />

      <Body muted>
        {mode === 'create'
          ? 'Save your profile and sync it across devices. Your on-device data stays where it is.'
          : 'Welcome back. Sign in to sync this device with your account.'}
      </Body>

      <Spacer size={spacing.lg} />

      <TextField
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (emailError) setEmailError(undefined);
        }}
        onBlur={onEmailBlur}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="next"
        placeholder="you@example.com"
        editable={!submitting}
      />
      <Spacer size={spacing.md} />
      <TextField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (passwordError) setPasswordError(undefined);
        }}
        onBlur={onPasswordBlur}
        error={passwordError}
        helper={passwordError ? undefined : mode === 'create' ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        returnKeyType={mode === 'create' ? 'next' : 'done'}
        onSubmitEditing={mode === 'signin' ? handleSubmit : undefined}
        editable={!submitting}
      />

      {mode === 'create' ? (
        <>
          <Spacer size={spacing.md} />
          <TextField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmError) setConfirmError(undefined);
            }}
            onBlur={onConfirmBlur}
            error={confirmError}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />
        </>
      ) : (
        <Row justify="flex-end" style={{ marginTop: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setResetNoticeVisible(true)}
            disabled={submitting}
          >
            <Small muted={false} style={{ color: color.primary }}>
              Forgot password?
            </Small>
          </Pressable>
        </Row>
      )}

      {resetNoticeVisible ? (
        <>
          <Spacer size={spacing.md} />
          <Callout tone="info" title="Coming soon">
            Password reset isn't built yet. Contact support if you're locked out.
          </Callout>
        </>
      ) : null}

      {mode === 'create' ? (
        <>
          <Spacer size={spacing.lg} />
          <Section title="Before you create an account" gap={spacing.md}>
            <ConsentCheckbox checked={tosChecked} onToggle={() => setTosChecked((v) => !v)} disabled={submitting}>
              <Body>
                I agree to the <InlineLink label="Terms of Service" onPress={() => router.push('/settings/terms')} /> and{' '}
                <InlineLink label="Privacy Policy" onPress={() => router.push('/settings/privacy')} />.
              </Body>
            </ConsentCheckbox>
            <ConsentCheckbox checked={healthChecked} onToggle={() => setHealthChecked((v) => !v)} disabled={submitting}>
              <Body>
                I consent to The Stack storing my health information (profile, stacks, logs) to provide personalised
                guidance. I can withdraw this at any time in Settings.
              </Body>
              <Small style={{ marginTop: spacing.xs }}>Required because this is special-category health data (GDPR Art. 9).</Small>
            </ConsentCheckbox>
          </Section>
        </>
      ) : null}

      <Spacer size={spacing.lg} />

      {formError ? (
        <>
          <Callout tone="critical" title={formError.title}>
            <Body>{formError.body}</Body>
            {formError.offerSignIn ? (
              <View style={{ marginTop: spacing.md }}>
                <Button variant="ghost" label="Sign in" onPress={() => flipMode('signin')} />
              </View>
            ) : null}
          </Callout>
          <Spacer size={spacing.md} />
        </>
      ) : null}

      <Button
        label={mode === 'create' ? 'Create account' : 'Sign in'}
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={submitting}
      />

      <Spacer size={spacing.md} />
      <Pressable accessibilityRole="button" onPress={() => flipMode(mode === 'create' ? 'signin' : 'create')} disabled={submitting}>
        <Small style={{ textAlign: 'center' }}>
          {mode === 'create' ? 'Already have an account? ' : 'New here? '}
          <Text style={{ color: color.primary, fontFamily: fonts.medium }}>
            {mode === 'create' ? 'Sign in' : 'Create an account'}
          </Text>
        </Small>
      </Pressable>

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}
