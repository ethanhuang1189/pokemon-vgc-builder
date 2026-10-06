import { useState } from 'react';
import Card from '../ui/Card';
import { Button, Notice, TextInput } from '../ui/controls';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useAuth } from '../../context/AuthContext';
import { signIn, signUp, sendPasswordReset, updatePassword } from '../../services/auth.js';
import { passwordProblem, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES } from '../../domain/passwordPolicy.js';

const MODES = {
  signIn: { title: 'Sign in', submit: 'Sign in', autoComplete: 'current-password' },
  signUp: { title: 'Create account', submit: 'Create account', autoComplete: 'new-password' },
  reset: { title: 'Reset password', submit: 'Send reset link' },
};

const SUCCESS = {
  signUp: 'Check your email for a link to confirm your account.',
  reset: 'If an account exists for that email, a reset link is on its way.',
};

function PasswordInput({ autoComplete, value, onChange, label = 'Password' }) {
  return (
    <TextInput label={label} type="password" required autoComplete={autoComplete} value={value}
      minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : undefined} maxLength={MAX_PASSWORD_BYTES}
      onChange={e => onChange(e.target.value)} />
  );
}

/** Sign in, create an account, or request a password-reset email. */
export function AuthPanel() {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();
  const config = MODES[mode];

  function switchMode(next) {
    setMode(next);
    setPassword('');
    setNotice(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = mode === 'signUp' && passwordProblem(password, email);
    if (problem) return setNotice({ tone: 'error', text: problem });

    const actions = {
      signIn: () => signIn(email, password),
      signUp: () => signUp(email, password),
      reset: () => sendPasswordReset(email),
    };
    await run(actions[mode], SUCCESS[mode]);
    if (mode !== 'signIn') setPassword('');
  }

  return (
    <Card title={config.title} subtitle="An account keeps your Showdown battles and stats in one place.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <TextInput label="Email" type="email" required autoComplete="email" maxLength={254}
          value={email} onChange={e => setEmail(e.target.value)} />
        {config.autoComplete && <PasswordInput autoComplete={config.autoComplete} value={password} onChange={setPassword} />}
        {mode === 'signUp' && <p className="text-[11px] text-gray-500">At least {MIN_PASSWORD_LENGTH} characters. A long passphrase is best.</p>}
        <Notice notice={notice} />
        <Button type="submit" disabled={pending} className="w-full py-2">{pending ? 'Working…' : config.submit}</Button>
      </form>
      <div className="flex justify-between mt-3">
        {mode === 'signIn'
          ? <Button tone="link" onClick={() => switchMode('signUp')}>Create an account</Button>
          : <Button tone="link" onClick={() => switchMode('signIn')}>Back to sign in</Button>}
        {mode === 'signIn' && <Button tone="link" onClick={() => switchMode('reset')}>Forgot password?</Button>}
      </div>
    </Card>
  );
}

/** Shown after following a password-reset email link. */
export function SetPasswordForm() {
  const { user, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const { pending, notice, setNotice, run } = useAsyncAction();

  async function handleSubmit(e) {
    e.preventDefault();
    const problem = passwordProblem(password, user?.email);
    if (problem) return setNotice({ tone: 'error', text: problem });
    if (await run(() => updatePassword(password).then(() => true))) finishRecovery();
  }

  return (
    <Card title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-3">
        <PasswordInput label="New password" autoComplete="new-password" value={password} onChange={setPassword} />
        <Notice notice={notice} />
        <Button type="submit" disabled={pending} className="w-full py-2">{pending ? 'Saving…' : 'Save password'}</Button>
      </form>
    </Card>
  );
}
