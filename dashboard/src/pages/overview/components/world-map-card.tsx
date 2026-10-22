import { WorldMap } from "@/components/shadcnmaps/maps/world"
import { worldMapData } from "@/components/shadcnmaps/map-data/world"
import { Skeleton } from "@/components/ui/skeleton"
import type { OverviewCountryDistribution } from "@/api/contracts"
import { OverviewRefreshButton } from "./overview-refresh-button"

const countryMapMetadata = [
  { code: "US", flag: "🇺🇸", mapPosition: { x: 180, y: 300 } },
  { code: "GB", flag: "🇬🇧", mapPosition: { x: 466, y: 274 } },
  { code: "EG", flag: "🇪🇬", mapPosition: { x: 561, y: 385 } },
  { code: "CA", flag: "🇨🇦", mapPosition: { x: 203, y: 173 } },
  { code: "DE", flag: "🇩🇪", mapPosition: { x: 504, y: 295 } },
  { code: "AU", flag: "🇦🇺", mapPosition: { x: 856, y: 560 } },
] as const

type WorldMapCardProps = {
  countries: OverviewCountryDistribution[]
  isLoading: boolean
  onRefresh: () => void
}

export function WorldMapCard({ countries, isLoading, onRefresh }: WorldMapCardProps) {
  const countryDistribution = countries.map((country) => ({ ...country, flag: countryFlag(country.code) }))
  const mapCountries = countryDistribution.flatMap((country) => {
    const metadata = countryMapMetadata.find(({ code }) => code === mapCountryCode(country.code))
    return metadata ? [{ ...country, ...metadata }] : []
  })
  const selectedCountries = new Map<string, (typeof mapCountries)[number]>(mapCountries.map((country) => [country.code, country]))
  const mapRegions = worldMapData.regions.map(({ id }) => {
    const country = selectedCountries.get(id)

    return country
      ? {
          id,
          abbreviation: country.country,
          labelX: country.mapPosition.x,
          labelY: country.mapPosition.y,
          className: "fill-primary",
          labelClassName: "fill-primary-foreground text-[8px] font-semibold",
        }
      : {
          id,
          abbreviation: "",
          className: "fill-primary/25",
        }
  })

  return <section data-testid="world-map-card" aria-busy={isLoading} className="min-w-0 overflow-hidden rounded-3xl bg-card p-5 sm:p-6">
    <header className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Customer growth</h2>
      <OverviewRefreshButton label="Refresh customer growth data" isLoading={isLoading} onRefresh={onRefresh} />
    </header>
    <div className="mt-5 grid gap-5 lg:grid-cols-4 lg:items-stretch">
      <div className="min-w-0 lg:col-span-1 lg:pe-5">
        <ul aria-label="Customer distribution" aria-busy={isLoading}>
          {isLoading ? <CountryListSkeleton /> : countryDistribution.map(({ code, country, flag, percentage }) => <li key={code} className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-lg leading-none" aria-hidden="true">{flag}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{country}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">{percentage}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary motion-safe:animate-[country-share-bar-grow_700ms_ease-out_both]" style={{ "--country-share": `${percentage}%` } as React.CSSProperties} />
            </div>
          </li>)}
        </ul>
      </div>
      <div className="min-w-0 lg:col-span-3">
        <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-2xl bg-muted/45 p-2 sm:h-[360px] sm:p-4">
          <WorldMap aria-label="World map" regions={mapRegions} showLabels markers={mapCountries.map(({ code, country, percentage, mapPosition }) => ({
            id: code,
            x: mapPosition.x,
            y: mapPosition.y,
            label: `${country} customer share`,
            tooltipContent: `${country}: ${percentage}%`,
            content: <CountryMarker />,
          }))} className="h-[300px] w-full" />
        </div>
      </div>
    </div>
  </section>
}

function CountryListSkeleton() {
  return Array.from({ length: 5 }, (_, index) => <li key={index} data-testid="country-skeleton-row" aria-hidden="true" className="py-3">
    <div className="flex items-center gap-3">
      <Skeleton className="size-6 shrink-0 rounded-sm" />
      <Skeleton className="h-4 min-w-0 flex-1" />
      <Skeleton className="h-3 w-8 shrink-0" />
    </div>
    <Skeleton className="mt-2 h-1.5 w-full" />
  </li>)
}

function countryFlag(code: string) {
  const normalizedCode = mapCountryCode(code)
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return "🌐"

  return String.fromCodePoint(...normalizedCode.split("").map((letter) => 127397 + letter.charCodeAt(0)))
}

function mapCountryCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()

  return normalizedCode === "UK" ? "GB" : normalizedCode
}

function CountryMarker() {
  return <g aria-hidden="true">
    <circle r="12" className="animate-ping fill-emerald-400/35" />
    <circle r="5" className="fill-emerald-400 stroke-emerald-100 stroke-1" />
    <circle r="2" className="fill-white" />
  </g>
}
