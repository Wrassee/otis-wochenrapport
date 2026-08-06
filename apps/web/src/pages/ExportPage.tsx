import { useState, useEffect } from 'react'
import { ExportSummary } from '@/components/export/ExportSummary'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import { getWeekDates, formatDateShort, haversineDistance } from '@/lib/utils'
import { getZoneReference, zoneForCoordinates } from '@/lib/zoneReference'
import { ensureLiftRow, geocodeAndApplyZone } from '@/lib/locationZones'
import { geocodeAddress } from '@/lib/geocode'
import * as localDb from '@/db/indexeddb'
import { getDrivingDistance } from '@/lib/routing'
import { cn } from '@/lib/cn'
import { Calendar, FileSpreadsheet, Info } from 'lucide-react'
import { generateExcelOffline } from '@/services/offlineGenerator'
import type { OfflineEntry, OfflineExpense } from '@/services/offlineGenerator'
import type { TimeEntry, Location, FavoriteLocation } from '@/lib/types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { dataUrlToBase64 } from '@/lib/photoUtils'
import { loadWeekExpensePhotos } from '@/lib/expensePhotos'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import type { ExpensePhoto } from '@/lib/types'

export function ExportPage() {
  const { t } = useTranslation()
  const {
    currentWeek,
    weekSummary,
    loadWeekEntries,
    calculateWeekSummary,
    timeEntries,
    dailyExpenses,
    setLocations,
    setFavoriteLocations,
    user,
  } = useAppStore(
    useShallow((s) => ({
      currentWeek: s.currentWeek,
      weekSummary: s.weekSummary,
      loadWeekEntries: s.loadWeekEntries,
      calculateWeekSummary: s.calculateWeekSummary,
      timeEntries: s.timeEntries,
      dailyExpenses: s.dailyExpenses,
      setLocations: s.setLocations,
      setFavoriteLocations: s.setFavoriteLocations,
      user: s.user,
    })),
  )
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('')
  // Receipt photos come from the store-backed hook — Dashboard/Woche share the
  // same data, and the Export page just renders the merged week's photos.
  const { photos, removePhoto } = useExpensePhotos(currentWeek.year, currentWeek.week)
  useEffect(() => {
    loadWeekEntries()
  }, [currentWeek, loadWeekEntries])

  // Pre-warm the backend when the Export page opens: Render's free tier spins
  // down after ~15 min idle and a cold start takes ~20s. This fire-and-forget
  // health ping wakes the server while the user is still looking at the page,
  // so the actual export/email fetch usually finds it warm instead of racing
  // the cold start (the 30s AbortSignal timeout is the safety net either way).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.onLine) return
    const renderUrl = import.meta.env.VITE_RENDER_URL
    if (!renderUrl) return
    fetch(`${renderUrl}/health`, { signal: AbortSignal.timeout(15000) }).catch(() => {})
  }, [])

  useEffect(() => {
    calculateWeekSummary()
  }, [timeEntries, calculateWeekSummary])

  /**
   * Auto-heal missing lift coordinates before building the report.
   *
   * A lift whose geocoded coordinates never reached the device (e.g. a Z0 row
   * from before the zone pipeline, or a cloud row without lat/lon) resolves to
   * a defaulted/stored zone (often the old Z1 fallback) even though the real
   * distance puts it in a higher zone — Hausen am Albis ≈ 20 km must be Z2,
   * not Z1. When online, geocode this week's work lifts that lack coordinates,
   * persist the result (IndexedDB + sync queue → Supabase) and refresh the
   * store so both the report marks and the Z4/Z5 km allowance use real
   * coordinates. Offline this is a no-op and the stored fallback applies.
   */
  const ensureWeekLiftZones = async (): Promise<void> => {
    // Offline (the common mobile export case) the geocoder is unreachable —
    // skip the heal entirely instead of waiting ~1s per lift for failures.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const weekDates = getWeekDates(currentWeek.year, currentWeek.week)
    const inWeek = new Set(weekDates)
    // Authoritative lift lookups come from IndexedDB, not the render closure —
    // the store's locations/favorites are only refreshed on syncs and may miss
    // a lift that exists locally (e.g. one the wizard just persisted), which
    // would otherwise create a duplicate row for the same Anlagenummer.
    const [dbLocations, dbFavorites] = await Promise.all([
      localDb.getAllLocations(),
      localDb.getFavoriteLocations(),
    ])
    // Collect every distinct lift of the week. Lifts may exist in the DB
    // (locations/favorites) OR only on the entries themselves (wizard-typed
    // lifts that were never persisted) — both carry a healable address.
    const lifts = new Map<
      string,
      { src: Location | FavoriteLocation | null; address: string; projectId: string }
    >()
    for (const e of timeEntries) {
      if (e.is_lunch || !e.location_anlagenummer || !inWeek.has(e.date)) continue
      const key = e.location_anlagenummer.toUpperCase()
      const existing = lifts.get(key)
      if (existing) {
        if (!existing.address && e.location_address) existing.address = e.location_address
        if (!existing.projectId && e.location_project_id) existing.projectId = e.location_project_id
        continue
      }
      const loc = dbLocations.find((l) => l.anlagenummer.toUpperCase() === key)
      const fav = dbFavorites.find((f) => f.anlagenummer.toUpperCase() === key)
      const src = loc || fav || null
      lifts.set(key, {
        src,
        address: src?.full_address || e.location_address || '',
        projectId: src?.project_id || e.location_project_id || '',
      })
    }

    // Cap the heal per export run: a long tail of ungeocoded lifts must not
    // stall the button — the first successful heal persists coordinates, so
    // later exports skip them anyway.
    const HEAL_CAP = 8
    let healed = 0
    let attempted = 0
    for (const [key, { src, address, projectId }] of lifts) {
      // A manual override always wins; existing coordinates are already fine.
      if (src && src.manual_zone !== undefined) continue
      if (src && Number(src.latitude) && Number(src.longitude)) continue
      if (!address || address.trim().length < 5) continue
      if (attempted >= HEAL_CAP) break
      attempted++
      try {
        if (src) {
          // Known lift — geocode + persist via the shared helper.
          // Per-call budget: a hanging Nominatim request (like a hanging
          // backend) must never stall the export — race the geocode against a
          // timeout.
          const result = await Promise.race([
            geocodeAndApplyZone(key, address.trim(), src),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ])
          if (result) healed++
        } else {
          // Entry-only lift (typed in the wizard, never persisted): geocode
          // the entry's address, then create the location + favorite rows with
          // the real coordinates (shared ensureLiftRow) so the report (and
          // other devices) get the correct zone and future exports skip this
          // lift.
          const result = await Promise.race([
            geocodeAddress(address.trim()),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
          ])
          if (!result) continue
          await ensureLiftRow(key, projectId, address.trim(), {
            geo: {
              latitude: result.lat,
              longitude: result.lon,
              zone: zoneForCoordinates(result.lat, result.lon),
            },
          })
          healed++
        }
      } catch (err) {
        console.warn('Export zone heal failed for', key, err)
      }
    }

    if (healed > 0) {
      // Refresh the store so resolveEntryZone / collectKmAllowances use the
      // freshly geocoded coordinates instead of the stored fallback.
      const updatedLocs = await localDb.getAllLocations()
      setLocations(updatedLocs)
      const updatedFavs = await localDb.getFavoriteLocations()
      setFavoriteLocations(updatedFavs)
    }
  }

  /**
   * Resolve the TRUSTWORTHY zone for an entry — mirrors the Settings lift list
   * (liftEffectiveZone): a manual override always wins, otherwise the zone is
   * recomputed from the geocoded coordinates and the current reference point.
   * A stale stored zone (e.g. a leftover of the old Z0→Z1 default) is never
   * trusted — the report and the km allowance use the same zone the user sees.
   * Returns the coordinates too, for the Z4/Z5 km calculation.
   *
   * The lift lookup uses the LIVE store state (not this render's closure) so
   * the export-time zone heal that refreshes locations/favorites is picked up
   * immediately by buildEntriesData and collectKmAllowances.
   */
  const resolveEntryZone = (e: TimeEntry): { zone: number; lat: number; lon: number } => {
    const { locations: liveLocations, favoriteLocations: liveFavorites } =
      useAppStore.getState()
    let manualZone: number | undefined
    let lat = 0
    let lon = 0
    if (e.location_anlagenummer) {
      const key = e.location_anlagenummer.toUpperCase()
      const loc = liveLocations.find((l) => l.anlagenummer.toUpperCase() === key)
      if (loc) {
        manualZone = loc.manual_zone
        lat = loc.latitude || 0
        lon = loc.longitude || 0
      } else {
        const fav = liveFavorites.find((f) => f.anlagenummer.toUpperCase() === key)
        if (fav) {
          manualZone = fav.manual_zone
          lat = fav.latitude || 0
          lon = fav.longitude || 0
        }
      }
    }
    if (manualZone !== undefined) return { zone: manualZone, lat, lon }
    if (lat && lon) {
      return {
        zone: zoneForCoordinates(lat, lon),
        lat,
        lon,
      }
    }
    // No geocoded lift → fall back to whatever the entry carried (usually 0).
    return { zone: e.location_zone || 0, lat: 0, lon: 0 }
  }

  const buildEntriesData = (): OfflineEntry[] => {
    return timeEntries.map((e) => {
      const { zone } = resolveEntryZone(e)
      // Last resort for the Spesenrapport: a work day whose lift is truly
      // unknown (no coordinates, no stored zone) is marked Z1 so the report
      // always gets a zone — the Settings lift list shows such lifts honestly
      // as 'Auto' and the batch recalc geocodes them into their real zone.
      // Absence entries (A01/A03/…) never get a zone mark (no Spesen).
      const effectiveZone =
        !e.is_lunch && !zone && !(e.activity_code || '').startsWith('A') ? 1 : zone
      // Absence days created before the 07:30 default (the wizard's
      // ABSENCE_START) start at 7:00 — heal the report so A* days read
      // 07:30–16:00 like the current rule.
      const startTime =
        !e.is_lunch && (e.activity_code || '').startsWith('A') && e.start_time === 7
          ? 7.5
          : e.start_time
      return {
        date: e.date,
        start_time: startTime,
        duration: e.duration,
        anlagenummer: e.location_anlagenummer || '',
        project_id: e.location_project_id || '',
        address: e.location_address || '',
        // Work entries without an explicit activity get the default NK marker
        // (Normalkosten) so the protocol always shows a checkmark per line.
        activity_code: e.activity_code || (e.is_lunch ? '' : 'NK'),
        is_lunch: e.is_lunch,
        zone: effectiveZone,
      }
    })
  }

  /**
   * Z4/Z5 km allowance per weekday (Mon=0..Fri=4) for the Spesenrapport's
   * "Zone 4 + 5 (variable) · CHF -.10 / km" row (row 24).
   *
   * Rule: on days whose highest zone is Z4 or Z5 (60+ km straight-line → the
   * rule kicks in automatically by zone), the technician is entitled to
   * 0.10 CHF per km DRIVEN. The driven distance comes from OSRM road routing
   * (real route, e.g. 68 km straight-line ≈ 114 km driven one way → 228 km
   * round trip → 22.80 CHF); when offline the straight-line distance ×2 is
   * used as a fallback estimate. Written per day column.
   */
  const collectKmAllowances = async (): Promise<Record<number, number>> => {
    const zoneRef = getZoneReference()
    const weekDates = getWeekDates(currentWeek.year, currentWeek.week)
    const result: Record<number, number> = {}

    // Per-day candidates: { weekday, home→lift } for the max-zone lift.
    const candidates: { weekday: number; from: { lat: number; lon: number }; to: { lat: number; lon: number } }[] = []

    weekDates.forEach((date, weekday) => {
      const dayEntries = timeEntries.filter((e) => e.date === date && !e.is_lunch)
      if (dayEntries.length === 0) return

      // Highest zone per day + the coordinates of the lift that set it (for
      // the km calc we keep the FARTHEST lift when several share the max zone).
      // Zones come from resolveEntryZone — the same trustworthy, coordinate-
      // based zones used for the report marks and the Settings lift list.
      let maxZone = 0
      let best: { lat: number; lon: number } | null = null
      for (const e of dayEntries) {
        const { zone, lat, lon } = resolveEntryZone(e)
        if (zone > maxZone) {
          maxZone = zone
          best = lat && lon ? { lat, lon } : null
        } else if (zone === maxZone && zone > 0 && lat && lon) {
          const d1 = haversineDistance(zoneRef.lat, zoneRef.lon, lat, lon)
          const d0 = best
            ? haversineDistance(zoneRef.lat, zoneRef.lon, best.lat, best.lon)
            : 0
          if (d1 > d0) best = { lat, lon }
        }
      }

      // Only Z4/Z5 days get the km allowance (60+ km straight-line).
      if (maxZone >= 4 && best) {
        candidates.push({ weekday, from: zoneRef, to: best })
      }
    })

    if (candidates.length === 0) return result

    // Real driven distance via OSRM (parallel, but never block the export on
    // slow routing — each request times out after 5 s and getDrivingDistance
    // itself returns null instead of throwing, so this can't stall the export).
    const routes = await Promise.all(
      candidates.map((c) =>
        getDrivingDistance(c.from.lat, c.from.lon, c.to.lat, c.to.lon).then((r) => ({ c, r })),
      ),
    )

    for (const { c, r } of routes) {
      // Driven route when available, else straight-line as fallback.
      const oneWayKm =
        r !== null && r > 0
          ? r
          : haversineDistance(c.from.lat, c.from.lon, c.to.lat, c.to.lon)
      const roundTripKm = 2 * oneWayKm
      const chf = Math.round(roundTripKm * 0.1 * 100) / 100
      if (chf > 0) result[c.weekday] = chf
    }

    return result
  }

  const collectWeekExpenses = (): OfflineExpense[] => {
    const all: OfflineExpense[] = []
    const weekDates = getWeekDates(currentWeek.year, currentWeek.week)
    for (const d of weekDates) {
      const dayExp = dailyExpenses[d]
      if (dayExp && dayExp.length > 0) {
        all.push(...dayExp)
      }
    }
    return all
  }

  /** Photographed receipts (Spesen Belege) for the current week — merged local + cloud. */
  const collectWeekPhotos = async (): Promise<ExpensePhoto[]> => {
    try {
      return await loadWeekExpensePhotos(user?.id, currentWeek.year, currentWeek.week)
    } catch (e) {
      console.warn('Failed to load receipt photos:', e)
      return []
    }
  }

  /** Non-empty photo notes for the current week, in display order. */
  const collectPhotoNotes = (): string[] => {
    return photos.map((p) => p.note?.trim() || '').filter((n) => n.length > 0)
  }

  /**
   * Export filename incl. the week's date range,
   * e.g. Wochenrapport_KW31_2026_27_07-31_07.xlsx (Mon–Fri, DD_MM).
   */
  const buildFilename = (): string => {
    const dates = getWeekDates(currentWeek.year, currentWeek.week)
    const fmt = (d: string) => {
      const [, mm, dd] = d.split('-') // YYYY-MM-DD → DD_MM
      return `${dd}_${mm}`
    }
    return `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}_${fmt(dates[0])}-${fmt(dates[4])}.xlsx`
  }

  /**
   * Generate the week's Excel blob — backend first, offline fallback.
   * Shared by both the export and email buttons.
   */
  const generateWeekBlob = async (): Promise<{ blob: Blob; usedOffline: boolean }> => {
    const state = useAppStore.getState()
    // Geocode any of this week's lifts that lack coordinates so their zones
    // (and the Z4/Z5 km allowance) are correct in the report.
    await ensureWeekLiftZones()
    const entriesData = buildEntriesData()
    const allExpenses = collectWeekExpenses()
    const photoNotes = collectPhotoNotes()
    const kmAllowances = await collectKmAllowances()

    try {
      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
      const response = await fetch(`${renderUrl}/generate-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: currentWeek.year,
          week_number: currentWeek.week,
          user_id: state.user?.id,
          personnel_number: state.profile?.personnel_number || '',
          full_name: state.profile?.full_name || '',
          entries: entriesData,
          expenses: allExpenses,
          photo_notes: photoNotes,
          km_allowances: kmAllowances,
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(detail.slice(0, 200))
      }
      const blob = await response.blob()
      return { blob, usedOffline: false }
    } catch (innerErr: any) {
      // Backend unreachable — fall back to offline generation (expected on mobile).
      console.warn('Backend unreachable, generating Excel offline:', innerErr)
      const blob = await generateExcelOffline({
        year: currentWeek.year,
        week_number: currentWeek.week,
        personnel_number: state.profile?.personnel_number || '',
        full_name: state.profile?.full_name || '',
        entries: entriesData,
        expenses: allExpenses,
        photo_notes: photoNotes,
        km_allowances: kmAllowances,
      })
      return { blob, usedOffline: true }
    }
  }

  /**
   * Save a Blob (+ optional receipt photos) to the device.
   * Strategy — two approaches in order:
   *   1. Capacitor Filesystem.writeFile + Share.share() — main file first, then
   *      each receipt photo; all URIs are passed to the Share dialog so the
   *      email attachment includes the photographed invoices too.
   *   2. Manual download link (user taps it — always visible)
   */
  const saveBlob = async (
    blob: Blob,
    filename: string,
    dialogTitle?: string,
    attachments: { filename: string; dataUrl: string }[] = [],
  ) => {
    const blobUrl = window.URL.createObjectURL(blob)

    // 1. Capacitor native file write (silent, best-effort)
    const isNative = Capacitor.getPlatform() !== 'web'
    if (isNative) {
      try {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Data,
        })

        // Write each receipt photo to internal storage
        const photoUris: string[] = []
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i]
          await Filesystem.writeFile({
            path: att.filename,
            data: dataUrlToBase64(att.dataUrl),
            directory: Directory.Data,
          })
          const stat = await Filesystem.getUri({
            path: att.filename,
            directory: Directory.Data,
          })
          photoUris.push(stat.uri)
        }

        // 1b. Open native Share dialog so user can save/email the file(s)
        try {
          const fileStat = await Filesystem.getUri({
            path: filename,
            directory: Directory.Data,
          })
          const allUris = [fileStat.uri, ...photoUris]
          await Share.share({
            // urls is Android-only. Pass url: allUris[0] alongside urls so iOS
            // still shares the Excel file (Android ignores url when urls is set).
            ...(allUris.length > 1 ? { urls: allUris, url: allUris[0] } : { url: allUris[0] }),
            title: filename,
            dialogTitle: dialogTitle || t('export.excel.btn'),
          })
        } catch (shareErr: any) {
          // Share sheet cancelled or failed — the manual download link remains as fallback.
          console.warn('Share cancelled or failed:', shareErr)
        }
      } catch (e: any) {
        console.error('Capacitor native write failed — falling back to download link:', e)
      }
    }

    // 2. Web: start the download automatically (PC browsers save it right
    // away). The manual link below stays visible as a fallback for browsers
    // that block programmatic downloads.
    if (!isNative) {
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.rel = 'noopener'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => document.body.removeChild(a), 100)
    }

    // 3. Manual download link (always available as backup)
    setDownloadUrl(blobUrl)
    setDownloadFilename(filename)
  }

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)
    try {
      const { blob, usedOffline } = await generateWeekBlob()
      const filename = buildFilename()
      await saveBlob(blob, filename, t('export.excel.btn'))
      setStatus(
        usedOffline
          ? `${t('export.success')} (${t('export.offline.generated')})`
          : t('export.success'),
      )
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      console.error('Excel export failed:', err)
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    setSending(true)
    setStatus(null)
    try {
      const { blob, usedOffline } = await generateWeekBlob()
      const filename = buildFilename()

      // Collect photographed receipts for this week and attach them to the
      // Share sheet — the email app receives the Excel + all Belege together.
      const photos = await collectWeekPhotos()
      const attachments = photos.map((p, i) => ({
        filename: p.filename || `Beleg_${currentWeek.week}_${i + 1}.jpg`,
        dataUrl: p.dataUrl,
      }))

      // Open the native Share sheet — the user picks their email app from there,
      // same pattern as the export button.
      await saveBlob(blob, filename, t('export.email.btn'), attachments)
      const photoNote =
        attachments.length > 0
          ? ` (${t('export.email.attachments', { n: attachments.length })})`
          : ''
      setStatus(
        usedOffline
          ? `${t('export.email.success')}${photoNote} (${t('export.offline.generated')})`
          : `${t('export.email.success')}${photoNote}`,
      )
    } catch (err: any) {
      console.error('Email send failed:', err)
      setStatus(`${t('common.error')}: ${err.message || t('export.email.failed')}`)
    } finally {
      setSending(false)
    }
  }

  if (!weekSummary) return null

  const dates = getWeekDates(currentWeek.year, currentWeek.week)

  return (
    <div className="space-y-4">
      {/* Week header */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20 flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-otis-800 dark:text-white">
                {t('export.title', { week: currentWeek.week })}
              </h2>
              <Badge variant={weekSummary.totalHours > 0 ? 'info' : 'warning'}>
                {weekSummary.totalHours.toFixed(1)}h
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-stone-300" />
              <p className="text-xs text-gray-500 dark:text-stone-400">
                {formatDateShort(dates[0])} – {formatDateShort(dates[4])}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status message */}
      {status && (
        <Card variant={status.startsWith(t('common.error')) ? 'danger' : 'success'}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                status.startsWith(t('common.error')) ? 'bg-red-500' : 'bg-emerald-500',
              )}
            />
            <p className="text-sm font-medium">{status}</p>
          </div>
        </Card>
      )}

      {/* Receipt photos attached to this week's report */}
      <ReceiptPhotos photos={photos} onDelete={removePhoto} />

      {/* Export summary */}
      <ExportSummary
        weekSummary={weekSummary}
        onExport={handleExport}
        onSendEmail={handleSendEmail}
        exporting={exporting}
        sending={sending}
      />

      {/* Manual download link — shown when auto-download needs user action */}
      {downloadUrl && (
        <Card className="!border-amber-200/60 dark:!border-amber-700/40 !bg-amber-50/80 dark:!bg-amber-900/20">
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="flex items-center gap-3 py-1"
            onClick={() => {
              setTimeout(() => {
                window.URL.revokeObjectURL(downloadUrl!)
                setDownloadUrl(null)
              }, 10000)
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {t('export.download.manual')}
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 truncate">
                {downloadFilename}
              </p>
            </div>
          </a>
        </Card>
      )}

      {/* Info tip */}
      <Card variant="outline">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-otis-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 dark:text-stone-300 leading-relaxed">
            {t('export.info')}
          </p>
        </div>
      </Card>
    </div>
  )
}
