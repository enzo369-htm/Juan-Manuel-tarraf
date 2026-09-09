type Props = {
  label: string
  es: string
  en: string
  onEs: (value: string) => void
  onEn: (value: string) => void
  multiline?: boolean
  maxLength?: number
  rows?: number
  placeholderEs?: string
  placeholderEn?: string
  required?: boolean
  disabled?: boolean
  inputClass?: string
}

export function BilingualField({
  label,
  es,
  en,
  onEs,
  onEn,
  multiline = false,
  maxLength,
  rows = 4,
  placeholderEs,
  placeholderEn,
  required = false,
  disabled = false,
  inputClass,
}: Props) {
  return (
    <div className="admin-i18n">
      {label ? <p className="admin-i18n__label">{label}</p> : null}
      <div className="admin-i18n__grid">
        <label className="admin-login__label">
          Español
          {multiline ? (
            <textarea
              className={inputClass}
              value={es}
              maxLength={maxLength}
              rows={rows}
              placeholder={placeholderEs}
              required={required}
              disabled={disabled}
              onChange={(e) => onEs(e.target.value)}
            />
          ) : (
            <input
              className={inputClass}
              value={es}
              maxLength={maxLength}
              placeholder={placeholderEs}
              required={required}
              disabled={disabled}
              onChange={(e) => onEs(e.target.value)}
            />
          )}
        </label>
        <label className="admin-login__label">
          English
          {multiline ? (
            <textarea
              className={inputClass}
              value={en}
              maxLength={maxLength}
              rows={rows}
              placeholder={placeholderEn}
              disabled={disabled}
              onChange={(e) => onEn(e.target.value)}
            />
          ) : (
            <input
              className={inputClass}
              value={en}
              maxLength={maxLength}
              placeholder={placeholderEn}
              disabled={disabled}
              onChange={(e) => onEn(e.target.value)}
            />
          )}
        </label>
      </div>
    </div>
  )
}
