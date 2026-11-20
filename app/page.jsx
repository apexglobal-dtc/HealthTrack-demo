'use client';
import { useEffect, useState } from 'react';
import App from '../src/ui/App.jsx';
import { createServerPlatform, remoteAI } from '../src/platform/server/client.js';
import { createArtifactPlatform } from '../src/platform/artifact/platform.js';

export default function Page() {
  const [platform, setPlatform] = useState(null);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) { setPlatform(createServerPlatform({ url, anonKey })); return; }
    // No database configured: keep data in this browser, but use Claude on the server if a key is set.
    fetch('/api/ai/status').then((r) => r.json()).catch(() => ({})).then((s) =>
      createArtifactPlatform({ mode: 'browser', ai: remoteAI(s?.available) })).then(setPlatform);
  }, []);
  return platform ? <App platform={platform} /> : null;
}
