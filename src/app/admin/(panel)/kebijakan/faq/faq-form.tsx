import { UnsavedChangesGuard } from "@/components/admin/unsaved-changes-guard"
import { createFaqItem, updateFaqItem } from "../actions"

type FaqFormProps = {
  item?: {
    id: string
    question: string
    answer: string
    sortOrder: number
  }
}

const inputClass =
  "w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
const labelClass = "mb-1 block text-sm font-semibold"

export function FaqForm({ item }: FaqFormProps) {
  const isEdit = Boolean(item)
  const action = isEdit ? updateFaqItem : createFaqItem

  return (
    <UnsavedChangesGuard>
      <form action={action} className="max-w-xl space-y-4">
        {isEdit && <input type="hidden" name="id" value={item?.id} />}

        <div>
          <label className={labelClass} htmlFor="question">
            Pertanyaan
          </label>
          <input id="question" name="question" defaultValue={item?.question} required className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="answer">
            Jawaban
          </label>
          <textarea id="answer" name="answer" defaultValue={item?.answer} required rows={4} className={inputClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor="sortOrder">
            Urutan Tampil (angka lebih kecil tampil dulu)
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 0}
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isEdit ? "Simpan Perubahan" : "Tambah FAQ"}
        </button>
      </form>
    </UnsavedChangesGuard>
  )
}
