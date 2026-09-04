"use client";
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      position: 'relative',
      backgroundColor: '#1a1210',
      color: '#f3f0ef',
      borderTop: '1px solid #3d2e27',
      overflow: 'hidden',
      fontFamily: 'var(--font-body, "Plus Jakarta Sans", sans-serif)',
      marginTop: 'auto',
      zIndex: 50,
    }}>
      {/* Top ambient glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '75%',
        height: '96px',
        background: 'linear-gradient(to bottom, rgba(255,102,0,0.15), transparent)',
        filter: 'blur(32px)',
        pointerEvents: 'none',
      }} />

      <div data-footer-inner style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '64px 120px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Grid */}
        <div data-footer-grid style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: '48px',
        }}>
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary, #ff6600), var(--primary-container, #ff8533))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(255,102,0,0.3)',
              }}>
                <svg width="20" height="20" fill="none" stroke="#fff" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span style={{
                fontSize: '20px',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: '#ffffff',
                fontFamily: 'var(--font-display, "Bricolage Grotesque", sans-serif)',
              }}>PacketPeek</span>
            </div>

            <p style={{
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#dbc2ae',
              maxWidth: '320px',
            }}>
              Scan packaged food barcodes to get transparent ingredient and nutrition data instantly.
              Make healthier choices with Zaika Score.
            </p>

            <div style={{ paddingTop: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(255,102,0,0.12)',
                color: 'var(--primary, #ff6600)',
                border: '1px solid rgba(255,102,0,0.25)',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary, #ff6600)',
                  marginRight: '8px',
                }} />
                AI-Powered OCR Active
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#f3f0ef',
              marginBottom: '4px',
            }}>Product</h4>
            {[
              { href: '/scan', label: 'Barcode Scanner' },
              { href: '/contributions', label: 'My Contributions' },
              { href: '/history', label: 'Scan History' },
              { href: '/insights', label: 'Zaika Score Insights' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: '14px',
                color: '#dbc2ae',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary, #ff6600)'}
              onMouseOut={(e) => e.currentTarget.style.color = '#dbc2ae'}
              >{label}</Link>
            ))}
          </div>

          {/* Company Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#f3f0ef',
              marginBottom: '4px',
            }}>Company</h4>
            {[
              { href: '/about', label: 'About Us' },
              { href: '/careers', label: 'Careers' },
              { href: '/contact', label: 'Contact Support' },
              { href: '/community', label: 'Community Guidelines' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: '14px',
                color: '#dbc2ae',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary, #ff6600)'}
              onMouseOut={(e) => e.currentTarget.style.color = '#dbc2ae'}
              >{label}</Link>
            ))}
          </div>

          {/* Legal Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#f3f0ef',
              marginBottom: '4px',
            }}>Legal</h4>
            {[
              { href: '/privacy', label: 'Privacy Policy' },
              { href: '/terms', label: 'Terms of Service' },
              { href: '/cookies', label: 'Cookie Policy' },
              { href: '/disclaimer', label: 'Health Disclaimer' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                fontSize: '14px',
                color: '#dbc2ae',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary, #ff6600)'}
              onMouseOut={(e) => e.currentTarget.style.color = '#dbc2ae'}
              >{label}</Link>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div data-footer-bottom style={{
          marginTop: '48px',
          paddingTop: '32px',
          borderTop: '1px solid #3d2e27',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontSize: '12px',
          color: '#9d836f',
        }}>
          <p>© {new Date().getFullYear()} PacketPeek. All rights reserved.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {[
              { href: '/privacy', label: 'Privacy' },
              { href: '/security', label: 'Security' },
              { href: '/terms', label: 'Terms' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} style={{
                color: '#9d836f',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary, #ff6600)'}
              onMouseOut={(e) => e.currentTarget.style.color = '#9d836f'}
              >{label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}