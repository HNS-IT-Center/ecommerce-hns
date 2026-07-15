import { PolicyPageLayout } from "@/components/layout/policy-page-layout"
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion"

export const metadata = {
  title: "FAQ — HNS IT Center",
  description: "Pertanyaan yang sering diajukan seputar belanja di HNS IT Center.",
}

const FAQ_ITEMS = [
  {
    question: "Bagaimana cara memesan produk?",
    answer:
      "Cari produk yang diinginkan di katalog, lalu klik tombol \"Tambah ke Keranjang\" atau \"Beli via WhatsApp\". Untuk saat ini, semua pesanan dikonfirmasi langsung oleh tim CS kami melalui WhatsApp.",
  },
  {
    question: "Apakah bisa bayar di tempat (COD)?",
    answer:
      "[KONFIRMASI: apakah COD tersedia, dan untuk area mana saja]. Untuk pembelian langsung di toko, pembayaran bisa dilakukan tunai atau transfer di tempat.",
  },
  {
    question: "Metode pembayaran apa saja yang diterima?",
    answer:
      "Transfer bank (BCA, Mandiri, BRI, BNI) dan QRIS. Detail rekening akan diinformasikan oleh CS saat konfirmasi pesanan.",
  },
  {
    question: "Apakah produk yang dijual bergaransi?",
    answer:
      "[KONFIRMASI: berapa lama garansi berlaku dan apakah garansi resmi distributor/toko].",
  },
  {
    question: "Bagaimana jika produk yang diterima rusak atau tidak sesuai pesanan?",
    answer:
      "Hubungi CS kami sesegera mungkin melalui WhatsApp dengan bukti foto/video. Lihat detail lengkap di halaman Kebijakan Pengembalian Barang.",
  },
  {
    question: "Apakah bisa custom rakit PC (Custom PC Builder)?",
    answer:
      "Bisa. Gunakan fitur PC Builder untuk memilih komponen, atau konsultasi langsung dengan tim kami via WhatsApp untuk rekomendasi sesuai kebutuhan dan budget.",
  },
  {
    question: "Apakah HNS IT Center menerima servis laptop/PC?",
    answer:
      "Ya, kami menerima servis dan upgrade hardware. Untuk info lebih lanjut, silakan hubungi CS atau kunjungi toko kami langsung.",
  },
  {
    question: "Di mana lokasi toko dan jam operasionalnya?",
    answer:
      "Kami memiliki 2 toko di Batam: Nagoya Gateway dan Nagoya Hill Mall. Lihat alamat dan jam operasional lengkap di halaman Toko Fisik.",
  },
]

export default function FaqPage() {
  return (
    <PolicyPageLayout title="Pertanyaan yang Sering Diajukan (FAQ)" breadcrumbLabel="FAQ">
      <Accordion className="not-prose">
        {FAQ_ITEMS.map((item, index) => (
          <AccordionItem key={index} value={String(index)}>
            <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
            <AccordionPanel className="text-muted-foreground">{item.answer}</AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </PolicyPageLayout>
  )
}
