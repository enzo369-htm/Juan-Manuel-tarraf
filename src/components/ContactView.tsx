type Props = {
  instagramHandle: string
  instagramUrl: string
  email: string
}

function hrefOf(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function InstagramIcon() {
  return (
    <svg className="contact__icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
      <circle cx="12" cy="12" r="4.15" />
      <circle cx="17.35" cy="6.65" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="contact__icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="1.4" />
      <path d="M4.4 7.1 12 13.1l7.6-6" />
    </svg>
  )
}

export function ContactView({ instagramHandle, instagramUrl, email }: Props) {
  const igHref = hrefOf(instagramUrl)
  const igLabel = instagramHandle.trim()
  const mail = email.trim()
  const hasIg = Boolean(igLabel || igHref)
  const hasMail = Boolean(mail)

  if (!hasIg && !hasMail) {
    return (
      <div className="contact">
        <p className="section-view__note">
          Espacio de contacto. El contenido se carga desde el CMS.
        </p>
      </div>
    )
  }

  return (
    <div className="contact">
      <ul className="contact__list">
        {hasIg && (
          <li>
            {igHref ? (
              <a
                className="contact__row"
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon />
                <span>{igLabel || igHref}</span>
              </a>
            ) : (
              <span className="contact__row">
                <InstagramIcon />
                <span>{igLabel}</span>
              </span>
            )}
          </li>
        )}
        {hasMail && (
          <li>
            <a className="contact__row" href={`mailto:${mail}`}>
              <MailIcon />
              <span>{mail}</span>
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}
