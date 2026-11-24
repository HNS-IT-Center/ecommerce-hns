"use client"

import * as React from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import {
  MAX_RULE_MESSAGE_LENGTH,
  isRequireRuleMatch,
  type PcBuilderRequireRule,
  type RequireRuleMatch,
} from "@/lib/pc-builder/require-rules"

export const MATCH_LABELS: Record<RequireRuleMatch, string> = {
  has: "punya",
  lacks: "tidak punya",
}

/** Daftar nilai sepanjang ini baru diberi kotak cari. */
const VALUE_SEARCH_THRESHOLD = 8

export type RuleAttributeOption = {
  id: number
  name: string
  values: { id: number; value: string }[]
}

/** Aturan yang belum lengkap — dipakai panel & form untuk menolak simpan. */
export function isRuleIncomplete(rule: PcBuilderRequireRule): boolean {
  return rule.attributeId <= 0 || rule.valueIds.length === 0 || rule.targetStepId === ""
}

interface RequireRulesEditorProps {
  /** Step yang sedang disunting (draf). Aturannya milik step ini. */
  step: PcBuilderStepConfig
  /** Step lain yang bisa dijadikan tujuan (bukan step ini sendiri). */
  targetSteps: PcBuilderStepConfig[]
  attributes: RuleAttributeOption[]
  onChange: (rules: PcBuilderRequireRule[]) => void
}

/**
 * Tab "Aturan Wajib" di panel edit step admin PC Builder.
 * Arti & batas aturannya ada di `lib/pc-builder/require-rules.ts`.
 */
export function RequireRulesEditor({ step, targetSteps, attributes, onChange }: RequireRulesEditorProps) {
  const rules = step.requireRules ?? []

  const addRule = () => {
    onChange([
      ...rules,
      {
        id: Math.random().toString(36).substring(2, 9),
        attributeId: 0,
        valueIds: [],
        match: "has",
        targetStepId: "",
      },
    ])
  }

  const updateRule = (ruleId: string, patch: Partial<PcBuilderRequireRule>) => {
    onChange(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)))
  }

  const removeRule = (ruleId: string) => {
    onChange(rules.filter((r) => r.id !== ruleId))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Kalau komponen yang dipilih di step ini memenuhi syarat, step tujuan menjadi wajib
        diisi. Produk yang <strong className="text-foreground">belum punya</strong> atribut
        tersebut sama sekali tidak memicu aturan — beri nilai lain (mis. &quot;Tidak ada&quot;)
        supaya aturan &quot;tidak punya&quot; menyala.
      </p>

      {rules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Belum ada aturan.
        </p>
      ) : (
        rules.map((rule) => (
          <RuleRow
            key={rule.id}
            stepName={step.name.trim() || "step ini"}
            rule={rule}
            targetSteps={targetSteps}
            attributes={attributes}
            onUpdate={(patch) => updateRule(rule.id, patch)}
            onRemove={() => removeRule(rule.id)}
          />
        ))
      )}

      <Button type="button" variant="outline" onClick={addRule} className="gap-1.5">
        <Plus className="h-4 w-4" /> Tambah aturan
      </Button>
    </div>
  )
}

interface RuleRowProps {
  stepName: string
  rule: PcBuilderRequireRule
  targetSteps: PcBuilderStepConfig[]
  attributes: RuleAttributeOption[]
  onUpdate: (patch: Partial<PcBuilderRequireRule>) => void
  onRemove: () => void
}

function RuleRow({ stepName, rule, targetSteps, attributes, onUpdate, onRemove }: RuleRowProps) {
  const [valueSearch, setValueSearch] = React.useState("")

  const attribute = attributes.find((a) => a.id === rule.attributeId)
  const values = attribute?.values ?? []
  const filteredValues = values.filter((v) =>
    v.value.toLowerCase().includes(valueSearch.toLowerCase())
  )
  const target = targetSteps.find((s) => s.id === rule.targetStepId)

  const toggleValue = (valueId: number) => {
    const next = new Set(rule.valueIds)
    if (next.has(valueId)) next.delete(valueId)
    else next.add(valueId)
    onUpdate({ valueIds: Array.from(next) })
  }

  // Pratinjau memakai aturan yang SAMA dengan toast di /build-pc
  // (`describeRequirement`): pesan staff didahulukan, titik akhirnya dibuang.
  const message = (rule.message ?? "").trim().replace(/[.\s]+$/, "")
  const autoReason = `${stepName} yang dipilih memiliki ${attribute?.name ?? "…"}: …`

  const selectClass =
    "h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
  const idBase = `rule-${rule.id}`

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-op`} className="text-xs font-semibold text-muted-foreground">
            Jika {stepName}
          </label>
          <select
            id={`${idBase}-op`}
            value={rule.match}
            onChange={(e) => {
              const value = e.target.value
              if (isRequireRuleMatch(value)) onUpdate({ match: value })
            }}
            className={selectClass}
          >
            {(Object.keys(MATCH_LABELS) as RequireRuleMatch[]).map((m) => (
              <option key={m} value={m}>
                {MATCH_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idBase}-attr`} className="text-xs font-semibold text-muted-foreground">
            Atribut
          </label>
          <select
            id={`${idBase}-attr`}
            value={rule.attributeId > 0 ? String(rule.attributeId) : ""}
            onChange={(e) => {
              setValueSearch("")
              // Nilai milik atribut lama tidak berarti apa pun untuk atribut baru.
              onUpdate({ attributeId: Number(e.target.value) || 0, valueIds: [] })
            }}
            className={selectClass}
          >
            <option value="">Pilih atribut…</option>
            {attributes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {attribute && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground">Nilai (cukup salah satu)</span>
          {values.length > VALUE_SEARCH_THRESHOLD && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Cari nilai atribut"
                placeholder="Cari nilai…"
                className="h-9 pl-8 text-sm"
                value={valueSearch}
                onChange={(e) => setValueSearch(e.target.value)}
              />
            </div>
          )}
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto [scrollbar-gutter:stable]">
            {filteredValues.map((v) => {
              const on = rule.valueIds.includes(v.id)
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleValue(v.id)}
                  className={`h-8 rounded-full border px-3 text-sm font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {v.value}
                </button>
              )
            })}
            {filteredValues.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {values.length === 0 ? "Atribut ini belum punya nilai." : "Nilai tidak ditemukan."}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-target`} className="text-xs font-semibold text-muted-foreground">
          maka wajib pilih
        </label>
        <select
          id={`${idBase}-target`}
          value={rule.targetStepId}
          onChange={(e) => onUpdate({ targetStepId: e.target.value })}
          className={selectClass}
        >
          <option value="">Pilih step…</option>
          {targetSteps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idBase}-msg`} className="text-xs font-semibold text-muted-foreground">
          Pesan untuk pelanggan (opsional)
        </label>
        <Input
          id={`${idBase}-msg`}
          value={rule.message ?? ""}
          maxLength={MAX_RULE_MESSAGE_LENGTH}
          placeholder="mis. Processor yang dipilih tidak memiliki Grafis Internal"
          onChange={(e) => onUpdate({ message: e.target.value })}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          Kosong = kalimat otomatis dari nama atribut, mis. &quot;{autoReason}&quot;.
        </p>
      </div>

      {target && (
        <div className="space-y-0.5 rounded-lg border border-red-200 bg-background p-3 dark:border-red-900/60">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground">
            PRATINJAU DI /build-pc
          </p>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{target.name} belum dipilih</p>
          <p className="text-sm">Wajib diisi karena {message || autoReason}.</p>
        </div>
      )}

      {isRuleIncomplete(rule) && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Lengkapi atribut, minimal satu nilai, dan step tujuan — aturan yang belum lengkap tidak
          bisa diterapkan.
        </p>
      )}
      {target?.isRequired && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Step &quot;{target.name}&quot; sudah dicentang Wajib, jadi aturan ini tidak mengubah
          apa-apa. Matikan Wajib di step itu kalau ia hanya wajib dalam kondisi ini.
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-3.5 w-3.5" /> Hapus aturan
      </Button>
    </div>
  )
}
