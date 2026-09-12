import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design reference only (Bolt export), not project code — see .gitignore.
    "_ui_reference/**",
    // Berkas kerja lokal: skrip verifikasi sekali-pakai, cadangan, potongan
    // data. Di-gitignore dan tidak pernah ikut build, jadi meliniknya hanya
    // menambah bising yang menenggelamkan temuan sungguhan di src/.
    "scratch/**",
    // Worktree git milik agent (`git worktree list`). Isinya SALINAN berkas
    // yang sama dengan di src/, jadi satu masalah nyata terhitung berkali-kali
    // dan jumlah error yang beredar jadi lebih besar dari masalah sebenarnya —
    // persis hal yang membuat orang berhenti mempercayai angkanya. Di-gitignore
    // (.gitignore:148) dan tidak pernah ikut build. Yang dilinik tetap salinan
    // di src/, bukan yang ini.
    ".claude/**",
  ]),
]);

export default eslintConfig;
