import { Laptop, Cpu, Keyboard, Monitor, Printer } from "lucide-react"

// Data placeholder — belum tersambung ke order asli.
// Ganti dengan hasil query order terbaru begitu lib/services/dashboard tersedia.
const recentOrders = [
  {
    icon: Laptop,
    product: "ASUS ROG Strix G16",
    buyer: "Andi Saputra",
    amount: "Rp 18.500.000",
  },
  {
    icon: Cpu,
    product: "AMD Ryzen 7 7800X3D",
    buyer: "Budi Hartono",
    amount: "Rp 5.750.000",
  },
  {
    icon: Monitor,
    product: "LG UltraGear 27\" 165Hz",
    buyer: "Citra Wulandari",
    amount: "Rp 3.200.000",
  },
  {
    icon: Keyboard,
    product: "Keychron K8 Pro",
    buyer: "Dedi Kurniawan",
    amount: "Rp 1.150.000",
  },
  {
    icon: Printer,
    product: "Epson EcoTank L3250",
    buyer: "Eka Putri",
    amount: "Rp 2.890.000",
  },
]

export function RecentSales() {
  return (
    <div className="space-y-6">
      {recentOrders.map((order) => (
        <div key={order.product} className="flex items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <order.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="ml-4 space-y-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">
              {order.product}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {order.buyer}
            </p>
          </div>
          <div className="ml-auto shrink-0 pl-2 font-medium">{order.amount}</div>
        </div>
      ))}
    </div>
  )
}
