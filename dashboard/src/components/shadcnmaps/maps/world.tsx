'use client'

import { Map, type MapProps } from '../map'
import { worldMapData } from '../map-data/world'

export type RegionId = (typeof worldMapData)['regions'][number]['id']

export type WorldMapProps = Omit<MapProps, 'data'>

export function WorldMap(props: WorldMapProps) {
  return <Map data={worldMapData} {...props} />
}
