import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AdBannerProps {
  position?: 'header' | 'footer' | 'sidebar' | 'between';
  isDeveloper?: boolean;
  className?: string;
}

export interface Ad {
  id: string;
  name: string;
  code: string;
  type: 'adsense' | 'adsterra' | 'custom';
  adUnitType: 'social_bar' | 'popunder' | 'banner' | 'native' | 'interstitial';
  position: 'header' | 'sidebar' | 'footer' | 'between' | 'popup' | 'inline';
  size?: string;
  enabled: boolean;
  paused: boolean;
}

const ADS_DOC = 'config/site_ads';
const STORAGE_KEY = 'finalyze_ads_config';

function loadAdsLocal(): Ad[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return stored.map((ad: any) => ({
      id: ad.id || '',
      name: ad.name || 'Untitled',
      code: ad.code || '',
      type: ad.type || 'adsterra',
      adUnitType: ad.adUnitType || 'banner',
      position: ad.position || 'header',
      size: ad.size || undefined,
      enabled: ad.enabled === true,
      paused: ad.paused === true,
    }));
  } catch { return []; }
}

async function loadAdsFromFirestore(): Promise<Ad[]> {
  try {
    const snap = await getDoc(doc(db, ADS_DOC));
    if (snap.exists()) {
      const data = snap.data();
      return (data.ads || []).map((ad: any) => ({
        id: ad.id || '',
        name: ad.name || 'Untitled',
        code: ad.code || '',
        type: ad.type || 'adsterra',
        adUnitType: ad.adUnitType || 'banner',
        position: ad.position || 'header',
        size: ad.size || undefined,
        enabled: ad.enabled === true,
        paused: ad.paused === true,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

async function loadAdsMerged(): Promise<Ad[]> {
  const firestoreAds = await loadAdsFromFirestore();
  if (firestoreAds.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreAds));
    return firestoreAds;
  }
  return loadAdsLocal();
}

export default function AdBanner({ position = 'footer', isDeveloper = false, className = '' }: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeAd, setActiveAd] = useState<Ad | null>(null);

  useEffect(() => {
    if (isDeveloper) return;

    loadAdsMerged().then(ads => {
      const found = ads.find(ad =>
        ad.enabled &&
        !ad.paused &&
        ad.adUnitType === 'banner' &&
        ad.position === position &&
        ad.code
      );
      setActiveAd(found || null);
    });
  }, [isDeveloper, position]);

  useEffect(() => {
    if (!containerRef.current || !activeAd?.code) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = activeAd.code;

    const scripts = tempDiv.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
        newScript.async = true;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      container.appendChild(newScript);
    });

    Array.from(tempDiv.childNodes).forEach(node => {
      if (node.nodeName !== 'SCRIPT') {
        container.appendChild(node.cloneNode(true));
      }
    });

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [activeAd]);

  if (isDeveloper || !activeAd) return null;

  return (
    <div className={`${className}`}>
      <div className="w-full h-[30px] bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
      <div className="flex justify-center py-4">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
