export function BrandPartners() {
  const brands = ["Asus", "MSI", "Acer", "Lenovo", "Logitech", "Razer", "Rexus", "AMD", "Intel"]

  return (
    <section className="border-y border-border/50 bg-muted/20 py-8 overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <h3 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
          BRAND PARTNER RESMI
        </h3>
        
        {/* Simple marquee wrapper */}
        <div className="relative flex w-full overflow-hidden">
          <div className="flex w-max animate-marquee gap-8 md:gap-16">
            {[...brands, ...brands, ...brands].map((brand, i) => (
              <div 
                key={i}
                className="flex items-center justify-center text-xl md:text-2xl font-bold text-muted-foreground/60 hover:text-foreground transition-colors cursor-default"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
