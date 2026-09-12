import { Metadata } from "next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CalendarDateRangePicker } from "@/components/admin/date-range-picker"
import { Overview } from "@/components/admin/overview"
import { RecentSales } from "@/components/admin/recent-sales"
import { Download, Wallet, ShoppingCart, PackageX, Users } from "lucide-react"

// Data placeholder — belum tersambung ke sumber order/produk asli.
const stats = [
  {
    title: "Total Penjualan",
    value: "Rp 45.231.890",
    change: "+20.1% dari bulan lalu",
    icon: Wallet,
  },
  {
    title: "Pesanan Baru",
    value: "+128",
    change: "+18% dari bulan lalu",
    icon: ShoppingCart,
  },
  {
    title: "Stok Menipis",
    value: "7 produk",
    change: "Perlu restock minggu ini",
    icon: PackageX,
  },
  {
    title: "Pengguna Aktif",
    value: "+573",
    change: "+201 sejak jam lalu",
    icon: Users,
  },
]

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin Dashboard",
}

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-4 sm:p-6 sm:pt-6 lg:p-8 lg:pt-6 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2 sm:gap-0">
          <CalendarDateRangePicker />
          <Button size="sm" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" disabled>
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" disabled>
            Reports
          </TabsTrigger>
          <TabsTrigger value="notifications" disabled>
            Notifications
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="min-w-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold truncate">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.change}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 min-w-0 lg:grid-cols-7">
            <Card className="min-w-0 lg:col-span-4">
              <CardHeader>
                <CardTitle>Tren Penjualan</CardTitle>
                <CardDescription>
                  Data placeholder — belum tersambung ke sumber revenue asli.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 pl-2">
                <Overview />
              </CardContent>
            </Card>
            <Card className="min-w-0 lg:col-span-3">
              <CardHeader>
                <CardTitle>Pesanan Terbaru</CardTitle>
                <CardDescription>
                  Data placeholder — belum tersambung ke order asli.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                <RecentSales />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
