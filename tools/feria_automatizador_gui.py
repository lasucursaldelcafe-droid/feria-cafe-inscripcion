#!/usr/bin/env python3
"""
App Windows — Automatizador Feria Café (tkinter, sin dependencias extra).

Uso:
  py tools/feria_automatizador_gui.py
  Doble clic: AUTOMATIZAR.bat (raíz del repo)
"""

from __future__ import annotations

import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, scrolledtext, ttk

TOOLS = Path(__file__).resolve().parent
PROJECT = TOOLS.parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from automatizar_faltantes import (  # noqa: E402
    Estado,
    aplicar_correcciones,
    auditar_faltantes,
    generar_reporte_html,
    read_env_var,
    write_env_var,
)
from _util import DEFAULT_FIREBASE_PROJECT  # noqa: E402

SITE = f"https://{DEFAULT_FIREBASE_PROJECT}.web.app"
BG = "#F5F0E8"
ACCENT = "#4B352A"
WARM = "#BB5E3C"
OK_C = "#5F7F4E"
WARN_C = "#C47A2C"
FAIL_C = "#BB5E3C"


class FeriaAutomatizadorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("La Sucursal del Café — Automatizador")
        self.geometry("920x640")
        self.minsize(720, 520)
        self.configure(bg=BG)

        self.log_queue: queue.Queue[str | None] = queue.Queue()
        self.busy = False

        self._build_ui()
        self.after(200, self._poll_log)
        self.after(400, self._refresh_audit)

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=ACCENT, padx=16, pady=12)
        header.pack(fill=tk.X)
        tk.Label(
            header,
            text="Automatizador — Feria Café + V60 + Pasaporte",
            fg="white",
            bg=ACCENT,
            font=("Segoe UI", 14, "bold"),
        ).pack(anchor=tk.W)
        tk.Label(
            header,
            text=f"Corrige faltantes: OAuth, secretos GitHub, deploy, Wallet · {SITE}",
            fg="#E9E6DD",
            bg=ACCENT,
            font=("Segoe UI", 9),
        ).pack(anchor=tk.W)

        body = tk.PanedWindow(self, orient=tk.HORIZONTAL, sashwidth=6, bg=BG)
        body.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        left = tk.Frame(body, bg=BG)
        body.add(left, width=340)

        tk.Label(left, text="Estado", bg=BG, fg=ACCENT, font=("Segoe UI", 11, "bold")).pack(
            anchor=tk.W, pady=(0, 4)
        )
        self.tree = ttk.Treeview(left, columns=("estado", "detalle"), show="headings", height=18)
        self.tree.heading("estado", text="Est.")
        self.tree.heading("detalle", text="Ítem / detalle")
        self.tree.column("estado", width=56, anchor=tk.CENTER)
        self.tree.column("detalle", width=260)
        self.tree.pack(fill=tk.BOTH, expand=True)

        sheet_frame = tk.LabelFrame(left, text="GOOGLE_SHEET_ID (opcional)", bg=BG, fg=ACCENT)
        sheet_frame.pack(fill=tk.X, pady=8)
        self.sheet_entry = tk.Entry(sheet_frame, font=("Consolas", 9))
        self.sheet_entry.pack(fill=tk.X, padx=6, pady=4)
        self.sheet_entry.insert(0, read_env_var("GOOGLE_SHEET_ID"))
        tk.Button(
            sheet_frame,
            text="Guardar en tools/.env",
            command=self._save_sheet_id,
            bg=WARM,
            fg="white",
            relief=tk.FLAT,
            cursor="hand2",
        ).pack(pady=4)

        btn_frame = tk.Frame(left, bg=BG)
        btn_frame.pack(fill=tk.X, pady=4)
        buttons = [
            ("Auditar", self._refresh_audit, "#6B5346"),
            ("Corregir todo", lambda: self._run_task("corregir"), OK_C),
            ("OAuth Apps Script", lambda: self._run_task("oauth"), WARM),
            ("Secretos GitHub", lambda: self._run_task("ci"), ACCENT),
            ("Deploy Firebase", lambda: self._run_task("deploy"), ACCENT),
            ("Google Wallet", lambda: self._run_task("wallet"), "#888"),
            ("Generar reporte", self._gen_report, "#555"),
        ]
        for i, (label, cmd, color) in enumerate(buttons):
            b = tk.Button(
                btn_frame,
                text=label,
                command=cmd,
                bg=color,
                fg="white",
                relief=tk.FLAT,
                padx=6,
                pady=4,
                cursor="hand2",
                font=("Segoe UI", 9),
            )
            b.grid(row=i // 2, column=i % 2, sticky="ew", padx=2, pady=2)
        btn_frame.columnconfigure(0, weight=1)
        btn_frame.columnconfigure(1, weight=1)

        right = tk.Frame(body, bg=BG)
        body.add(right)

        tk.Label(right, text="Registro", bg=BG, fg=ACCENT, font=("Segoe UI", 11, "bold")).pack(
            anchor=tk.W
        )
        self.log = scrolledtext.ScrolledText(
            right, wrap=tk.WORD, font=("Consolas", 9), bg="white", fg="#333"
        )
        self.log.pack(fill=tk.BOTH, expand=True)
        self.log.insert(tk.END, "Listo. Pulsa «Auditar» o «Corregir todo».\n")
        self.log.configure(state=tk.DISABLED)

        self.status = tk.Label(self, text="Idle", bg="#E9E6DD", fg=ACCENT, anchor=tk.W, padx=8)
        self.status.pack(fill=tk.X, side=tk.BOTTOM)

    def _log(self, msg: str) -> None:
        self.log_queue.put(msg)

    def _poll_log(self) -> None:
        try:
            while True:
                msg = self.log_queue.get_nowait()
                if msg is None:
                    self.busy = False
                    self.status.configure(text="Completado")
                else:
                    self.log.configure(state=tk.NORMAL)
                    self.log.insert(tk.END, msg + "\n")
                    self.log.see(tk.END)
                    self.log.configure(state=tk.DISABLED)
        except queue.Empty:
            pass
        self.after(150, self._poll_log)

    def _save_sheet_id(self) -> None:
        val = self.sheet_entry.get().strip()
        write_env_var("GOOGLE_SHEET_ID", val)
        messagebox.showinfo("Guardado", f"GOOGLE_SHEET_ID actualizado en tools/.env")
        self._refresh_audit()

    def _refresh_audit(self) -> None:
        for row in self.tree.get_children():
            self.tree.delete(row)
        informe = auditar_faltantes()
        color_map = {Estado.OK: OK_C, Estado.WARN: WARN_C, Estado.FAIL: FAIL_C, Estado.MANUAL: "#888"}
        for item in informe.items:
            tag = item.estado.value
            short = item.titulo[:40]
            self.tree.insert("", tk.END, values=(item.estado.value.upper(), f"{short}: {item.detalle[:80]}"), tags=(tag,))
        for st, color in color_map.items():
            self.tree.tag_configure(st.value, foreground=color)
        ok_n = sum(1 for i in informe.items if i.estado == Estado.OK)
        self.status.configure(text=f"Auditoría: {ok_n}/{len(informe.items)} OK")

    def _run_task(self, task: str) -> None:
        if self.busy:
            messagebox.showwarning("Ocupado", "Espera a que termine la tarea actual.")
            return
        self.busy = True
        self.status.configure(text=f"Ejecutando: {task}…")

        def worker() -> None:
            try:
                self._log(f"=== Inicio: {task} ===")
                if task == "corregir":
                    oauth_needed = not (TOOLS / "credentials" / ".oauth-script-token.json").is_file()
                    if oauth_needed:
                        self._log("Sin token OAuth — se abrira el navegador para autorizar Google.")
                    aplicar_correcciones(
                        oauth=oauth_needed,
                        wallet=True,
                        deploy=True,
                        ci=True,
                        log=self._log,
                    )
                elif task == "oauth":
                    aplicar_correcciones(oauth=True, wallet=False, deploy=False, ci=False, log=self._log)
                elif task == "ci":
                    subprocess.run(
                        [sys.executable, "tools/setup_github_ci.py"],
                        cwd=str(PROJECT),
                    )
                    if Path(TOOLS / "credentials" / ".oauth-script-token.json").is_file():
                        subprocess.run(
                            [sys.executable, "tools/setup_github_ci.py", "--apps-script"],
                            cwd=str(PROJECT),
                        )
                elif task == "deploy":
                    subprocess.run([sys.executable, "tools/deploy_firebase.py"], cwd=str(PROJECT))
                elif task == "wallet":
                    subprocess.run(
                        [sys.executable, "tools/setup_google_wallet.py", "--auto"],
                        cwd=str(PROJECT),
                    )
                self._log(f"=== Fin: {task} ===")
            except Exception as exc:  # noqa: BLE001
                self._log(f"[ERROR] {exc}")
            finally:
                self.log_queue.put(None)
                self.after(0, self._refresh_audit)

        threading.Thread(target=worker, daemon=True).start()

    def _gen_report(self) -> None:
        informe = auditar_faltantes()
        path = generar_reporte_html(informe)
        messagebox.showinfo("Reporte", f"Generado:\n{path}")


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    app = FeriaAutomatizadorApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
