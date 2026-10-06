export default function Card({ title, subtitle, action, children }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-sm p-4">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {title && <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h3>}
          {action}
        </div>
      )}
      {subtitle && <p className="text-xs text-gray-500 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}
