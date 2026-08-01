import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Globe, ExternalLink, Eye, Users, Calendar, TrendingUp, RefreshCw, BarChart3, MapPin, Link2, Trash2 } from 'lucide-react';
import { Language } from '../lib/i18n';
import { getSiteStats, getDailyStats, SiteStats, resetAllStats } from '../lib/tracking';

interface SiteStatsPageProps {
  lang: Language;
}

const SOURCE_ICONS: Record<string, string> = {
  'Google Search': '🔍',
  'Facebook': '📘',
  'Twitter/X': '🐦',
  'Instagram': '📸',
  'YouTube': '📺',
  'TikTok': '🎵',
  'LinkedIn': '💼',
  'Reddit': '🟠',
  'WhatsApp': '💬',
  'Telegram': '✈️',
  'Discord': '🎮',
  'GitHub': '🐙',
  'direct': '🔗',
  'Bing Search': '🔍',
  'Yahoo Search': '🔍',
  'DuckDuckGo': '🦆',
};

const SOURCE_COLORS: Record<string, string> = {
  'Google Search': '#4285F4',
  'Facebook': '#1877F2',
  'Twitter/X': '#1DA1F2',
  'Instagram': '#E4405F',
  'YouTube': '#FF0000',
  'TikTok': '#000000',
  'LinkedIn': '#0A66C2',
  'Reddit': '#FF4500',
  'WhatsApp': '#25D366',
  'Telegram': '#26A5E4',
  'direct': '#9CA3AF',
};

export default function SiteStatsPage({ lang }: SiteStatsPageProps) {
  const isAr = lang === 'ar';
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [dailyStats, setDailyStats] = useState<{ date: string; views: number; clicks: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([getSiteStats(), getDailyStats(7)]);
      setStats(s);
      setDailyStats(d);
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleReset = async () => {
    const confirmMsg = isAr ? 'هل أنت متأكد من مسح جميع الإحصائيات؟ لا يمكن التراجع.' : 'Are you sure you want to reset all statistics? This cannot be undone.';
    if (!confirm(confirmMsg)) return;
    setResetting(true);
    try {
      await resetAllStats();
      setStats(null);
      setDailyStats([]);
      await loadStats();
    } catch (e) {
      console.warn('Failed to reset stats:', e);
    }
    setResetting(false);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={32} className="text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
            <BarChart3 size={24} className="text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{isAr ? 'إحصائيات الموقع' : 'Site Statistics'}</h2>
            <p className="text-sm text-white/50">{isAr ? 'تتبع الزيارات والمصادر والدول' : 'Track visits, sources & countries'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-sm font-bold transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-sm font-bold transition-all"
          >
            <Trash2 size={16} className={resetting ? 'animate-spin' : ''} />
            {isAr ? 'مسح الكل' : 'Reset All'}
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-brand-alt rounded-2xl p-5 border border-white/10 text-center">
              <Eye size={22} className="text-blue-400 mx-auto mb-2" />
              <div className="text-4xl font-black text-blue-400">{stats.totalViews}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'مشاهدات إجمالية' : 'Total Views'}</div>
            </div>
            <div className="bg-brand-alt rounded-2xl p-5 border border-white/10 text-center">
              <Calendar size={22} className="text-emerald-400 mx-auto mb-2" />
              <div className="text-4xl font-black text-emerald-400">{stats.todayViews}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'مشاهدات اليوم' : 'Today Views'}</div>
            </div>
            <div className="bg-brand-alt rounded-2xl p-5 border border-white/10 text-center">
              <TrendingUp size={22} className="text-amber-400 mx-auto mb-2" />
              <div className="text-4xl font-black text-amber-400">{stats.totalClicks}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'نقرات إجمالية' : 'Total Clicks'}</div>
            </div>
            <div className="bg-brand-alt rounded-2xl p-5 border border-white/10 text-center">
              <Users size={22} className="text-purple-400 mx-auto mb-2" />
              <div className="text-4xl font-black text-purple-400">{stats.uniqueVisitors}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'زوار فريدين' : 'Unique Visitors'}</div>
            </div>
          </div>

          {/* Today Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-brand-alt rounded-2xl p-4 border border-white/10 text-center">
              <div className="text-3xl font-black text-blue-400">{stats.todayViews}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'مشاهدات اليوم' : "Today's Views"}</div>
            </div>
            <div className="bg-brand-alt rounded-2xl p-4 border border-white/10 text-center">
              <div className="text-3xl font-black text-amber-400">{stats.todayClicks}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'نقرات اليوم' : "Today's Clicks"}</div>
            </div>
            <div className="bg-brand-alt rounded-2xl p-4 border border-white/10 text-center">
              <div className="text-3xl font-black text-purple-400">{stats.todayUniqueVisitors}</div>
              <div className="text-sm text-white/60 font-bold mt-1">{isAr ? 'زوار اليوم' : "Today's Visitors"}</div>
            </div>
          </div>

          {/* Countries & Sources - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Countries */}
            <div className="bg-brand-alt rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={20} className="text-emerald-400" />
                <h3 className="text-lg font-black text-white">{isAr ? 'الدول الأكثر زيارة' : 'Top Countries'}</h3>
              </div>
              {stats.topCountries.length > 0 ? (
                <div className="space-y-3">
                  {stats.topCountries.map((c, i) => {
                    const maxViews = stats.topCountries[0]?.views || 1;
                    const pct = (c.views / maxViews) * 100;
                    return (
                      <div key={i} className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-emerald-400" />
                            <span className="text-base font-bold text-white">{c.country}</span>
                          </div>
                          <span className="text-base font-black text-emerald-400">{c.views} {isAr ? 'زيارة' : 'views'}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</div>
              )}
            </div>

            {/* Top Sources */}
            <div className="bg-brand-alt rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Link2 size={20} className="text-cyan-400" />
                <h3 className="text-lg font-black text-white">{isAr ? 'مصادر الزيارات' : 'Traffic Sources'}</h3>
              </div>
              {stats.topSources.length > 0 ? (
                <div className="space-y-3">
                  {stats.topSources.map((s, i) => {
                    const maxViews = stats.topSources[0]?.views || 1;
                    const pct = (s.views / maxViews) * 100;
                    const color = SOURCE_COLORS[s.source] || '#9CA3AF';
                    const icon = SOURCE_ICONS[s.source] || '🌐';
                    const displayName = s.source === 'direct' ? (isAr ? 'زيارة مباشرة' : 'Direct Visit') : s.source;
                    return (
                      <div key={i} className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{icon}</span>
                            <span className="text-base font-bold text-white">{displayName}</span>
                          </div>
                          <span className="text-base font-black" style={{ color }}>{s.views}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-white/30 text-sm">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</div>
              )}
            </div>
          </div>

          {/* Top Pages */}
          {stats.topPages.length > 0 && (
            <div className="bg-brand-alt rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Eye size={20} className="text-blue-400" />
                <h3 className="text-lg font-black text-white">{isAr ? 'أكثر الصفحات مشاهدة' : 'Most Viewed Pages'}</h3>
              </div>
              <div className="space-y-3">
                {stats.topPages.map((p, i) => {
                  const maxViews = stats.topPages[0]?.views || 1;
                  const pct = (p.views / maxViews) * 100;
                  return (
                    <div key={i} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-mono text-white/80">{p.page}</span>
                        <span className="text-base font-black text-blue-400">{p.views} {isAr ? 'مشاهدة' : 'views'}</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Clicks */}
          {stats.topClicks.length > 0 && (
            <div className="bg-brand-alt rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-amber-400" />
                <h3 className="text-lg font-black text-white">{isAr ? 'أكثر العناصر نقرة' : 'Most Clicked Elements'}</h3>
              </div>
              <div className="space-y-3">
                {stats.topClicks.map((c, i) => {
                  const maxClicks = stats.topClicks[0]?.clicks || 1;
                  const pct = (c.clicks / maxClicks) * 100;
                  return (
                    <div key={i} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-mono text-white/80">{c.element}</span>
                        <span className="text-base font-black text-amber-400">{c.clicks}</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Last 7 Days Chart */}
          {dailyStats.length > 0 && (
            <div className="bg-brand-alt rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={20} className="text-purple-400" />
                <h3 className="text-lg font-black text-white">{isAr ? 'آخر 7 أيام' : 'Last 7 Days'}</h3>
              </div>
              <div className="flex items-end gap-2 h-32">
                {dailyStats.map((d, i) => {
                  const maxVal = Math.max(...dailyStats.map(x => Math.max(x.views, x.clicks)), 1);
                  const viewHeight = (d.views / maxVal) * 100;
                  const clickHeight = (d.clicks / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-1 items-end" style={{ height: '100px' }}>
                        <div className="flex-1 bg-blue-500/70 rounded-t hover:bg-blue-400/90 transition-colors" style={{ height: `${viewHeight}%` }} title={`${d.views} views`} />
                        <div className="flex-1 bg-amber-500/70 rounded-t hover:bg-amber-400/90 transition-colors" style={{ height: `${clickHeight}%` }} title={`${d.clicks} clicks`} />
                      </div>
                      <div className="text-xs text-white/40 font-bold">{d.date.split('-')[2]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-6 justify-center mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500/70" />
                  <span className="text-sm text-white/50 font-bold">{isAr ? 'مشاهدات' : 'Views'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500/70" />
                  <span className="text-sm text-white/50 font-bold">{isAr ? 'نقرات' : 'Clicks'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
