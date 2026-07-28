/**
 * Perencanaan pemindahan kategori — fungsi murni, tanpa akses database.
 *
 * Modul ini sengaja tidak menyentuh Prisma supaya bisa dipakai dua pihak dengan
 * hasil yang persis sama: layar admin memakainya untuk menampilkan preview
 * sebelum PIC menekan simpan, dan server memakainya lagi sebagai pemutus
 * sesungguhnya saat menyimpan. Kalau aturannya ditulis dua kali, preview dan
 * kenyataan cepat atau lambat akan berbeda — dan preview yang berbohong lebih
 * berbahaya daripada tidak ada preview sama sekali.
 *
 * Kegagalan dikembalikan sebagai nilai, bukan exception, karena pemanggilnya
 * termasuk komponen client yang menampilkan alasannya sebagai teks biasa.
 */

export type MovableCategory = {
  id: number
  name: string
  path: string
  depth: number
  parentId: number | null
}

export type CategoryMoveStep = {
  id: number
  name: string
  oldPath: string
  newPath: string
  oldDepth: number
  newDepth: number
}

export type CategoryMovePlan = {
  target: CategoryMoveStep
  /** Seluruh keturunan yang path/depth-nya ikut ditulis ulang. */
  descendants: CategoryMoveStep[]
  newParentPath: string | null
}

export type CategoryMoveResult =
  | { ok: true; plan: CategoryMovePlan }
  | { ok: false; error: string }

/** Batas kolom `path` di skema (VarChar(500)). */
const PATH_MAX_LENGTH = 500

function childrenOf(categories: MovableCategory[]): Map<number | null, MovableCategory[]> {
  const map = new Map<number | null, MovableCategory[]>()
  for (const c of categories) {
    const key = c.parentId
    const list = map.get(key)
    if (list) list.push(c)
    else map.set(key, [c])
  }
  return map
}

/**
 * Keturunan ditelusuri lewat `parentId`, bukan lewat awalan `path`. Kalau suatu
 * saat ada path yang tertinggal basi, relasi induk-anak tetap jadi kebenaran —
 * dan pemindahan yang memakai path basi justru akan menyebarkan kesalahannya.
 */
export function collectDescendantIds(
  categories: MovableCategory[],
  rootId: number
): Set<number> {
  const children = childrenOf(categories)
  const found = new Set<number>()

  const walk = (id: number) => {
    for (const child of children.get(id) ?? []) {
      if (found.has(child.id)) continue // cincin rusak: berhenti, jangan berputar
      found.add(child.id)
      walk(child.id)
    }
  }
  walk(rootId)
  return found
}

export function planCategoryMove(
  categories: MovableCategory[],
  targetId: number,
  newParentId: number | null
): CategoryMoveResult {
  const byId = new Map(categories.map((c) => [c.id, c]))

  const target = byId.get(targetId)
  if (!target) return { ok: false, error: "Kategori tidak ditemukan." }

  if (newParentId === targetId) {
    return { ok: false, error: `"${target.name}" tidak bisa dipindahkan ke dalam dirinya sendiri.` }
  }

  const newParent = newParentId === null ? null : byId.get(newParentId)
  if (newParentId !== null && !newParent) {
    return { ok: false, error: "Kategori tujuan tidak ditemukan." }
  }

  if (target.parentId === newParentId) {
    return {
      ok: false,
      error: newParent
        ? `"${target.name}" memang sudah berada di bawah "${newParent.name}".`
        : `"${target.name}" memang sudah menjadi kategori utama.`,
    }
  }

  // Cegah cincin: telusuri ke atas dari tujuan. Kalau target ditemukan di jalur
  // leluhur tujuan, pemindahan ini akan memutus cabangnya dari pohon —
  // induknya jadi keturunannya sendiri dan seluruh subtree lenyap dari akar.
  let cursor = newParent
  const seen = new Set<number>()
  while (cursor) {
    if (cursor.id === targetId) {
      return {
        ok: false,
        error: `"${target.name}" tidak bisa dipindahkan ke dalam "${newParent!.name}", karena kategori itu berada di bawahnya.`,
      }
    }
    if (seen.has(cursor.id)) break // pohon sudah rusak sebelum kita sampai sini
    seen.add(cursor.id)
    cursor = cursor.parentId === null ? null : (byId.get(cursor.parentId) ?? null)
  }

  // Path disusun ulang dari nama + jalur induk barunya, bukan dengan memotong
  // path lama. Hasilnya sama untuk pohon yang sehat, tapi pohon yang sempat
  // tertinggal basi ikut dibetulkan alih-alih diperbanyak kesalahannya.
  const children = childrenOf(categories)
  const descendants: CategoryMoveStep[] = []

  const buildStep = (node: MovableCategory, parentPath: string | null, parentDepth: number): CategoryMoveStep => ({
    id: node.id,
    name: node.name,
    oldPath: node.path,
    newPath: parentPath === null ? node.name : `${parentPath} > ${node.name}`,
    oldDepth: node.depth,
    newDepth: parentDepth + 1,
  })

  const targetStep = buildStep(target, newParent?.path ?? null, newParent?.depth ?? 0)

  const walk = (parent: CategoryMoveStep) => {
    for (const child of children.get(parent.id) ?? []) {
      if (child.id === targetId) continue // jaga-jaga terhadap pohon yang sudah rusak
      const step = buildStep(child, parent.newPath, parent.newDepth)
      descendants.push(step)
      walk(step)
    }
  }
  walk(targetStep)

  const steps = [targetStep, ...descendants]

  const tooLong = steps.find((s) => s.newPath.length > PATH_MAX_LENGTH)
  if (tooLong) {
    return {
      ok: false,
      error: `Jalur kategori jadi terlalu panjang (${tooLong.newPath.length} karakter, batasnya ${PATH_MAX_LENGTH}).`,
    }
  }

  // Path wajib unik di skema. Yang ikut pindah dikecualikan dari pemeriksaan
  // karena path lamanya memang akan ditinggalkan.
  const moving = new Set(steps.map((s) => s.id))
  const takenPaths = new Map<string, string>()
  for (const c of categories) {
    if (!moving.has(c.id)) takenPaths.set(c.path, c.name)
  }
  const clash = steps.find((s) => takenPaths.has(s.newPath))
  if (clash) {
    return { ok: false, error: `Kategori "${clash.newPath}" sudah ada.` }
  }

  return {
    ok: true,
    plan: { target: targetStep, descendants, newParentPath: newParent?.path ?? null },
  }
}
