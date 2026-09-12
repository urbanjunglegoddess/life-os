import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { COLOR, RADIUS, SPACE, TARGET } from '@life-os/tokens';

import { sendEmailOtp, verifyEmailOtp } from '../../lib/auth.ts';
import { FlowScreen } from '../flow/FlowScreen.tsx';

/**
 * Email OTP sign-in — the flow primitive's first real caller.
 *
 * Two questions, one per screen: the address, then the code. §5.7 says not to
 * front-load setup; this is the shortest path to a usable app, and everything
 * else is asked later in context.
 */
type Stage = 'email' | 'code';

/**
 * Inputs take style objects because a TextInput's own text colour and padding
 * are not expressible as NativeWind classes on every platform. Still the
 * semantic tier — a hex here would be exactly the defect it is anywhere else.
 */
const inputStyle = {
  minHeight: TARGET['tap-target-min'],
  borderWidth: 1,
  borderColor: COLOR['border-meaningful'],
  borderRadius: RADIUS['radius-md'],
  paddingHorizontal: SPACE['space-4'],
  color: COLOR['text-primary'],
  fontSize: 16,
} as const;

export function SignInFlow({ onSignedIn }: { onSignedIn: () => void }) {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : 'Something went wrong.');

  async function submitEmail() {
    setBusy(true);
    setError(null);
    try {
      await sendEmailOtp(email);
      setStage('code');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      onSignedIn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const isEmail = stage === 'email';

  return (
    <FlowScreen
      position={isEmail ? 1 : 2}
      total={2}
      canGoBack={!isEmail}
      onBack={() => {
        setStage('email');
        setError(null);
      }}
      /* No list to escape to: two steps ARE the whole structure here. */
      title={isEmail ? 'What is your email?' : 'Enter the code'}
      context={
        isEmail
          ? 'We send a one-time code. No password to keep.'
          : `Sent to ${email}. It expires shortly.`
      }
      primary={{
        label: busy ? 'Working…' : isEmail ? 'Send code' : 'Sign in',
        hint: isEmail
          ? 'Emails a one-time sign-in code'
          : 'Verifies the code and signs you in',
        onPress: () => void (isEmail ? submitEmail() : submitCode()),
        disabled: busy || (isEmail ? email.trim() === '' : code.trim() === ''),
      }}
    >
      {isEmail ? (
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLOR['text-muted']}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          accessibilityLabel="Email address"
          style={inputStyle}
        />
      ) : (
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor={COLOR['text-muted']}
          keyboardType="number-pad"
          /* Lets the OS offer the code straight from the message. */
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          accessibilityLabel="One-time code"
          style={inputStyle}
        />
      )}

      {error !== null && (
        <View className="pt-2">
          {/* Spoken in words — ember is not audible (4.8 §7). */}
          <Text className="text-sm text-state-error">{error}</Text>
        </View>
      )}
    </FlowScreen>
  );
}
