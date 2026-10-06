// Form controls shared by the account and battle screens.

const BUTTON_TONES = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-100',
  danger: 'text-red-400 hover:text-red-300 border border-red-800',
  link: 'text-indigo-400 hover:text-indigo-300 underline underline-offset-2 px-0',
};

export function Button({ tone = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button type={type} {...props}
      className={`text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_TONES[tone]} ${className}`} />
  );
}

export function TextInput({ label, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-xs text-gray-400 mb-1">{label}</span>}
      <input {...props}
        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
    </label>
  );
}

const NOTICE_TONES = {
  error: 'text-red-300 bg-red-400/10',
  success: 'text-green-300 bg-green-400/10',
  info: 'text-gray-300 bg-gray-700/40',
};

/** A status line; renders nothing without a message. `notice` is { tone, text } or null. */
export function Notice({ notice }) {
  if (!notice?.text) return null;
  return <p role="status" className={`text-xs rounded px-2 py-1.5 ${NOTICE_TONES[notice.tone ?? 'info']}`}>{notice.text}</p>;
}
