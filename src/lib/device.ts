/** Best-effort description of this device for the hosts (no permissions, no GPS). */
export function describeDevice(): { device: string; user_agent: string; locale: string; screen: string } {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad|Macintosh(?=.*Mobile)/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "?";
  const browser = /Instagram/.test(ua) ? "Instagram" : /FBAN|FBAV/.test(ua) ? "Facebook" : /Snapchat/.test(ua) ? "Snapchat" : /EdgiOS|Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "?";
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const phone = /iPhone|Android.*Mobile/.test(ua);
  return {
    device: `${os} · ${browser}${installed ? " (installed)" : ""}${!phone && os !== "iPad" ? " · laptop" : ""}`,
    user_agent: ua.slice(0, 300),
    locale: navigator.language,
    screen: `${screen.width}×${screen.height}`,
  };
}

/** City-level location from the connection (approximate), or nothing if the service is down. */
export async function approximateLocation(): Promise<{ city?: string; region?: string; country?: string; ip?: string }> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
    if (r.ok) {
      const j = (await r.json()) as { city?: string; region?: string; country_name?: string; ip?: string };
      return { city: j.city, region: j.region, country: j.country_name, ip: j.ip };
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch("https://ipwho.is/", { signal: ctrl.signal });
    if (r.ok) {
      const j = (await r.json()) as { city?: string; region?: string; country?: string; ip?: string };
      return { city: j.city, region: j.region, country: j.country, ip: j.ip };
    }
  } catch {
    /* no location */
  } finally {
    window.clearTimeout(t);
  }
  return {};
}
