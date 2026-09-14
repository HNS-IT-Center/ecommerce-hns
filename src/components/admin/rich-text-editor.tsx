"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import TableCell from "@tiptap/extension-table-cell"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  TableIcon,
  Undo2,
  Redo2,
  Eye,
  Pencil,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /**
   * Kelas tinggi untuk area tulis DAN pratinjau, supaya keduanya tidak
   * berganti tinggi saat ditukar. Default pas untuk spesifikasi produk;
   * halaman kebijakan jauh lebih panjang, jadi ia mengoper nilainya sendiri.
   */
  heightClass?: string
  /** Tampil di pratinjau saat isinya masih kosong. */
  emptyPreviewHtml?: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <ToolbarButton
        label="Tebal"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Miring"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="Judul"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Sub Judul"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="Daftar Bullet"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Daftar Bernomor"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="Sisipkan Tabel"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
        }
      >
        <TableIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        label="Urungkan"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Ulangi"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  )
}

/**
 * Editor teks kaya untuk panel admin: Tiptap dengan dukungan tabel.
 *
 * Dipakai bersama oleh Spesifikasi produk (`admin/produk`) dan halaman
 * Kebijakan (`admin/kebijakan`). Dulu tinggal di `produk/spec-editor.tsx`;
 * dipindah ke sini saat kebijakan membutuhkan editor yang sama, daripada
 * menyalin 200 baris yang akan berbeda perilakunya suatu hari.
 *
 * Tabel wajib didukung, bukan sekadar bonus: output "Rapikan dengan AI" di
 * halaman produk berupa `<table>` HTML, dan editor yang tidak bisa
 * menyuntingnya akan merusak isi yang sudah ada.
 *
 * Pratinjau memakai `prose prose-sm max-w-none` — kelas yang sama dengan
 * storefront, supaya yang terlihat di sini benar-benar mencerminkan
 * tampilan aslinya.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  heightClass = "min-h-48 max-h-[22rem]",
  emptyPreviewHtml = "<p>Belum ada isi.</p>",
}: RichTextEditorProps) {
  const [mode, setMode] = React.useState<"edit" | "preview">("edit")

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Tulis spesifikasi produk di sini…" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        // Tinggi dibatasi & digulir di dalam: spesifikasi produk IT sering
        // puluhan baris, dan tanpa batas ini editornya memanjang terus sampai
        // tombol simpan terdorong jauh di bawah layar.
        class: cn(
          "prose prose-sm max-w-none overflow-y-auto px-3 py-2.5 text-xs focus:outline-none",
          heightClass
        ),
      },
    },
  })

  // Sinkronisasi saat value berubah dari luar (mis. tombol "Rapikan dengan AI"
  // menimpa isi editor) tanpa memutus posisi kursor pengguna saat mengetik biasa.
  React.useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background">
      <div className="flex items-center justify-between border-b border-input bg-muted/30 px-2 py-1.5">
        {mode === "edit" && editor ? <Toolbar editor={editor} /> : <div />}
        <div className="ms-auto flex shrink-0 items-center gap-1 ps-2">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setMode("edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setMode("preview")}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
        </div>
      </div>

      {mode === "edit" ? (
        <EditorContent editor={editor} />
      ) : (
        <div
          className={cn(
            "prose prose-sm max-w-none overflow-y-auto px-3 py-2.5 text-xs",
            heightClass,
            !value && "text-muted-foreground"
          )}
          dangerouslySetInnerHTML={{ __html: value || emptyPreviewHtml }}
        />
      )}
    </div>
  )
}
