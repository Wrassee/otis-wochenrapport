import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Calendar, Clock, FileSpreadsheet, Settings, Wifi, WifiOff, RefreshCw, Euro } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

interface AppShellProps {
  children: ReactNode
}

const navItems = [
  { path: '/dashboard', label: 'Erfassung', icon: Clock },
  { path: '/spesen', label: 'Spesen', icon: Euro },
  { path: '/weekly', label: 'Woche', icon: Calendar },
  { path: '/export', label: 'Export', icon: FileSpreadsheet },
  { path: '/settings', label: 'Einstellungen', icon: Settings },
]

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const syncStatus = useAppStore((s) => s.syncStatus)

  return (
    <div className="flex flex-col min-h-screen bg-otis-ambient dark:bg-otis-ambient-dark selection:bg-otis-200 selection:text-white">
      {/* Ambient decorative orbs */}
      <div className="fixed top-0 right-0 w-[300px] h-[300px] orb orb-blue dark:opacity-30 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="fixed top-1/3 left-0 w-[200px] h-[200px] orb orb-cyan dark:opacity-20 -translate-x-1/3 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[250px] h-[250px] orb orb-purple dark:opacity-20 translate-x-1/4 translate-y-1/4 pointer-events-none" />

      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-header dark:glass-header-dark">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            {/* OTIS Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-otis-600 to-otis-800 flex items-center justify-center shadow-lg shadow-otis-600/20">
                <span className="text-xs font-black text-white tracking-tight">O</span>
              </div>
              <div>
                <span className="text-sm font-bold text-otis-800 dark:text-white tracking-tight">OTIS</span>
                <span className="text-[10px] text-otis-400 dark:text-otis-300 ml-1.5 font-medium">Wochenrapport</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Sync indicator */}
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-300',
              syncStatus.online
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
            )}>
              {syncStatus.online ? (
                <><Wifi className="w-3 h-3" /> Online</>
              ) : (
                <><WifiOff className="w-3 h-3" /> Offline</>
              )}
            </div>
            {syncStatus.pendingSync > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {syncStatus.pendingSync}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-lg mx-auto px-4 py-5 pb-28 relative z-10">
          {children}
        </div>
      </main>

      {/* Bottom navigation - Glassmorphism */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 glass-nav dark:glass-nav-dark safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-4 min-h-[56px] relative',
                  'transition-all duration-200',
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-otis-500 shadow-lg shadow-otis-500/50" />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive
                      ? 'text-otis-600 dark:text-otis-400 scale-110'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-semibold transition-colors duration-200',
                    isActive
                      ? 'text-otis-600 dark:text-otis-400'
                      : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
