export type Store = {
  id: string
  name: string
  address: string
  hours: string
  /** TODO: ganti dengan short-link Google Maps asli per toko. */
  mapsUrl: string
  phone: string
}

export const STORES: Store[] = [
  {
    id: "nagoya-gateway",
    name: "Nagoya Gateway (Pusat)",
    address: "Komplek Nagoya Gateway, Blk. E No.9, Kp. Seraya, Kec. Batu Ampar, Kota Batam, Kepulauan Riau 29444",
    hours: "Setiap Hari : 09:00 - 21:00 WIB",
    mapsUrl: "https://maps.app.goo.gl/xxx",
    phone: "0811-7000-0000",
  },
  {
    id: "nagoya-hill",
    name: "Nagoya Hill Mall",
    address: "Nagoya Hill Mall Lt. Dasar, Lubuk Baja Kota, Kec. Lubuk Baja, Kota Batam, Kepulauan Riau 29444",
    hours: "Setiap Hari : 10:00 - 21:30 WIB",
    mapsUrl: "https://maps.app.goo.gl/yyy",
    phone: "0811-7000-0001",
  },
]
