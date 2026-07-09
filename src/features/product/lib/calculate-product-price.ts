export type CalculateProductPriceInput = {
  price: string
  regularPrice: string
  salePrice: string
  onSale: boolean
  isMember: boolean
}

export type CalculateProductPriceResult = {
  displayPrice: number
  displayRegular: number
  displaySale: number | null
  baseFinalPrice: number
  memberPrice: number
  finalPrice: number
  discountPercent: number
}

export function calculateProductPrice({
  price,
  regularPrice,
  salePrice,
  onSale,
  isMember,
}: CalculateProductPriceInput): CalculateProductPriceResult {
  const displayPrice = parseInt(price || "0", 10)
  const displayRegular = parseInt(regularPrice || price || "0", 10)
  const displaySale = salePrice ? parseInt(salePrice, 10) : null

  // Base final price (without member discount)
  const baseFinalPrice = onSale && displaySale ? displaySale : displayPrice

  // Simulate Member Price (5% discount from base final price)
  const memberPrice = Math.floor(baseFinalPrice * 0.95)
  const finalPrice = isMember ? memberPrice : baseFinalPrice

  // Calculate discount percentage (visual only for normal sale)
  const discountPercent =
    onSale && displaySale && displayRegular > 0
      ? Math.round(((displayRegular - displaySale) / displayRegular) * 100)
      : 0

  return {
    displayPrice,
    displayRegular,
    displaySale,
    baseFinalPrice,
    memberPrice,
    finalPrice,
    discountPercent,
  }
}
